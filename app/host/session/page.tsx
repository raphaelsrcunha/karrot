'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Peer, { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Quiz, QuizQuestion, SessionState, ParticipantAnswer, Participant } from '@/types/quiz';

export default function HostSessionPage() {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [roomCode, setRoomCode] = useState<string>('');
    const [peer, setPeer] = useState<Peer | null>(null);
    const [connections, setConnections] = useState<Map<string, DataConnection>>(new Map());
    const [sessionState, setSessionState] = useState<SessionState>({
        quizId: '',
        currentQuestionIndex: 0,
        isActive: false,
        hasStarted: false,
        participants: [],
        answers: []
    });
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [showRanking, setShowRanking] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(7);
    const [rankingAnimationStage, setRankingAnimationStage] = useState<'initial' | 'filling' | 'sorting' | 'done'>('initial');
    const [animatedParticipants, setAnimatedParticipants] = useState<any[]>([]);
    const [copiedLink, setCopiedLink] = useState<'direct' | 'base' | 'code' | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    const handleCopy = (text: string, type: 'direct' | 'base' | 'code') => {
        navigator.clipboard.writeText(text);
        setCopiedLink(type);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    // Initialize PeerJS and load quiz
    useEffect(() => {
        const storedQuiz = sessionStorage.getItem('currentQuiz');
        if (!storedQuiz) {
            router.push('/host');
            return;
        }

        const parsedQuiz = JSON.parse(storedQuiz);
        setQuiz(parsedQuiz);

        // Generate room code (6 characters)
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomCode(code);

        // Initialize PeerJS with room code as ID
        const newPeer = new Peer(code, {
            debug: 2,
        });

        // Prepare quiz for session: shuffle ranking questions once
        const preparedQuiz = { ...parsedQuiz };
        preparedQuiz.questions = preparedQuiz.questions.map((q: any) => {
            if (q.type === 'ranking' && q.options) {
                const originalOptions = [...q.options];
                const indexedOptions = originalOptions.map((opt, idx) => ({ opt, idx }));

                // Fisher-Yates shuffle
                for (let i = indexedOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indexedOptions[i], indexedOptions[j]] = [indexedOptions[j], indexedOptions[i]];
                }

                const shuffledOptions = indexedOptions.map(o => o.opt);
                const newCorrectOrder = originalOptions.map((_, originalIdx) =>
                    indexedOptions.findIndex(o => o.idx === originalIdx)
                );

                return {
                    ...q,
                    options: shuffledOptions,
                    correctOrder: newCorrectOrder
                };
            }
            return q;
        });
        setQuiz(preparedQuiz);

        newPeer.on('open', (id) => {
            console.log('Host peer ID:', id);
            setSessionState(prev => ({ ...prev, isActive: true, quizId: id }));
        });

        newPeer.on('connection', (conn) => {
            console.log('New participant connection:', conn.peer);

            conn.on('open', () => {
                // Send current quiz state to new participant
                // We use preparedQuiz here to ensure they get the shuffle immediately
                conn.send({
                    type: 'QUIZ_DATA',
                    payload: {
                        quiz: preparedQuiz,
                        currentQuestionIndex: sessionState.currentQuestionIndex,
                        hasStarted: sessionState.hasStarted,
                        timeLeft: timeLeft
                    }
                });

                // Update connections map
                setConnections(prev => new Map(prev).set(conn.peer, conn));
            });

            conn.on('data', (data: any) => {
                participantMessageHandlerRef.current?.(conn.peer, data);
            });

            conn.on('close', () => {
                console.log('Participant disconnected:', conn.peer);
                setConnections(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(conn.peer);
                    return newMap;
                });
                setSessionState(prev => ({
                    ...prev,
                    participants: prev.participants.filter(p => p.id !== conn.peer)
                }));
            });
        });

        newPeer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });

        setPeer(newPeer);

        return () => {
            newPeer.destroy();
        };
    }, []);

    const revealResults = () => {
        if (!quiz || showResults) return;

        const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];
        setShowResults(true);
        setShowLeaderboard(false);
        setTimeLeft(0);

        broadcastToAll({
            type: 'SHOW_RESULTS',
            payload: {
                questionId: currentQuestion.id,
                correctAnswer: currentQuestion.type === 'multiple-choice' ? currentQuestion.correctAnswer :
                    currentQuestion.type === 'multiple-select' ? currentQuestion.correctAnswers :
                        currentQuestion.type === 'ranking' ? currentQuestion.correctOrder : undefined,
                leaderboard: calculateScores()
            }
        });

        // Show leaderboard after 3 seconds
        setTimeout(() => setShowLeaderboard(true), 3000);
    };

    // Timer logic
    useEffect(() => {
        if (sessionState.hasStarted && quiz && !showResults) {
            const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];

            if (timeLeft === null) {
                setTimeLeft(currentQuestion.timeLimit || 30);
                return;
            }

            if (timeLeft > 0) {
                timerRef.current = setTimeout(() => {
                    setTimeLeft(prev => (prev !== null ? prev - 1 : null));
                }, 1000);
            } else if (timeLeft === 0) {
                revealResults();
            }
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [sessionState.hasStarted, sessionState.currentQuestionIndex, timeLeft, quiz, showResults]);

    const handleParticipantMessage = (participantId: string, data: any) => {
        switch (data.type) {
            case 'JOIN':
                const newParticipant: Participant = {
                    id: participantId,
                    name: data.payload.name,
                    avatar: data.payload.avatar,
                    connected: true
                };
                setSessionState(prev => ({
                    ...prev,
                    participants: [...prev.participants, newParticipant]
                }));
                break;

            case 'ANSWER':
                const answer: ParticipantAnswer = {
                    participantId,
                    participantName: data.payload.name,
                    questionId: data.payload.questionId,
                    answer: data.payload.answer,
                    timestamp: Date.now(),
                    timeLeftAtAnswer: timeLeft !== null ? timeLeft : undefined
                };
                setSessionState(prev => ({
                    ...prev,
                    answers: [...prev.answers, answer]
                }));
                break;
        }
    };

    // Use a ref for the message handler to avoid stale closures in PeerJS events
    const participantMessageHandlerRef = useRef<((participantId: string, data: any) => void) | null>(null);
    useEffect(() => {
        participantMessageHandlerRef.current = handleParticipantMessage;
    }, [handleParticipantMessage]);

    const broadcastToAll = (message: any) => {
        connections.forEach((conn) => {
            if (conn.open) {
                conn.send(message);
            }
        });
    };

    const handleStartQuiz = () => {
        setIsCountingDown(true);
        setCountdownValue(7);
        broadcastToAll({
            type: 'QUIZ_STARTING',
            payload: { countdown: 7 }
        });
    };

    // Countdown logic
    useEffect(() => {
        if (isCountingDown && countdownValue > 0) {
            countdownTimerRef.current = setTimeout(() => {
                setCountdownValue(prev => prev - 1);
            }, 1000);
        } else if (isCountingDown && countdownValue === 0) {
            setIsCountingDown(false);
            setSessionState(prev => ({ ...prev, hasStarted: true }));
            if (quiz) {
                broadcastToAll({
                    type: 'QUIZ_STARTED',
                    payload: {
                        timeLeft: quiz.questions[0].timeLimit || 30
                    }
                });
            }
        }

        return () => {
            if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
        };
    }, [isCountingDown, countdownValue]);

    const handleNextQuestion = () => {
        if (!quiz) return;

        // If we were showing results, move to next question or end
        if (showResults) {
            const nextIndex = sessionState.currentQuestionIndex + 1;
            if (nextIndex >= quiz.questions.length) {
                handleShowRanking();
                return;
            }
            setShowResults(false);
            setSessionState(prev => ({ ...prev, currentQuestionIndex: nextIndex }));
            setTimeLeft(null);
            broadcastToAll({
                type: 'NEXT_QUESTION',
                payload: {
                    questionIndex: nextIndex,
                    timeLeft: quiz.questions[nextIndex].timeLimit || 30
                }
            });
        } else {
            revealResults();
        }
    };

    const handlePreviousQuestion = () => {
        if (!quiz) return;

        const prevIndex = sessionState.currentQuestionIndex - 1;
        if (prevIndex < 0) return;

        setSessionState(prev => ({ ...prev, currentQuestionIndex: prevIndex }));
        setTimeLeft(null); // Reset timer for previous question

        broadcastToAll({
            type: 'NEXT_QUESTION',
            payload: {
                questionIndex: prevIndex,
                timeLeft: quiz.questions[prevIndex].timeLimit || 30
            }
        });
    };

    const handleDownloadResults = () => {
        if (!quiz) return;

        const results = {
            quiz: quiz,
            session: {
                roomCode,
                participants: sessionState.participants,
                answers: sessionState.answers,
                completedAt: new Date().toISOString()
            }
        };

        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `karrot-results-${roomCode}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleShowRanking = () => {
        const fullResults = calculateScores();
        // Initial state: Sort by score BEFORE the last question
        const initialSorted = [...fullResults].sort((a, b) => (b.score - b.pointsEarned) - (a.score - a.pointsEarned));

        setAnimatedParticipants(initialSorted);
        setRankingAnimationStage('initial');
        setShowRanking(true);

        broadcastToAll({
            type: 'SHOW_RANKING',
            payload: {}
        });

        // Animation Sequence:
        // 1. Initial view (0.5s)
        // 2. Fill bars (1.5s)
        // 3. Sort (1.5s)

        setTimeout(() => {
            setRankingAnimationStage('filling');
            setTimeout(() => {
                setRankingAnimationStage('sorting');
                setTimeout(() => {
                    setRankingAnimationStage('done');
                }, 2000);
            }, 2000);
        }, 1000);

        // Celebration!
        const duration = 10 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    const handleFinishQuiz = () => {
        broadcastToAll({
            type: 'QUIZ_ENDED',
            payload: {}
        });

        // Give a tiny bit of time for message to send before destroying
        setTimeout(() => {
            if (peer) peer.destroy();
            sessionStorage.removeItem('currentQuiz');
            router.push('/');
        }, 500);
    };

    const calculateScores = () => {
        if (!quiz) return [];

        const scores = sessionState.participants.map(participant => {
            let score = 0;
            let pointsEarned = 0;

            quiz.questions.forEach((question, idx) => {
                let currentQuestionPoints = 0;
                if (question.type === 'multiple-choice') {
                    const participantAnswer = sessionState.answers.find(
                        a => a.participantId === participant.id && a.questionId === question.id
                    );
                    if (participantAnswer && participantAnswer.answer === question.correctAnswer) {
                        const timeTaken = (participantAnswer.timeLeftAtAnswer || 0);
                        const limit = question.timeLimit || 30;
                        currentQuestionPoints = Math.max(0, Math.floor((timeTaken / limit) * 1000));
                    }
                } else if (question.type === 'multiple-select') {
                    const participantAnswer = sessionState.answers.find(
                        a => a.participantId === participant.id && a.questionId === question.id
                    );
                    if (participantAnswer && Array.isArray(participantAnswer.answer)) {
                        const correct = question.correctAnswers || [];
                        const given = participantAnswer.answer as number[];
                        if (correct.length === given.length && correct.every(v => given.includes(v))) {
                            const timeTaken = (participantAnswer.timeLeftAtAnswer || 0);
                            const limit = question.timeLimit || 30;
                            currentQuestionPoints = Math.max(0, Math.floor((timeTaken / limit) * 1000));
                        }
                    }
                } else if (question.type === 'ranking') {
                    const participantAnswer = sessionState.answers.find(
                        a => a.participantId === participant.id && a.questionId === question.id
                    );
                    if (participantAnswer && Array.isArray(participantAnswer.answer)) {
                        const correct = question.correctOrder || [];
                        const given = participantAnswer.answer as number[];
                        if (correct.length === given.length && correct.every((val, idx) => val === given[idx])) {
                            const timeTaken = (participantAnswer.timeLeftAtAnswer || 0);
                            const limit = question.timeLimit || 30;
                            currentQuestionPoints = Math.max(0, Math.floor((timeTaken / limit) * 1000));
                        }
                    }
                }

                score += currentQuestionPoints;
                if (idx === sessionState.currentQuestionIndex) {
                    pointsEarned = currentQuestionPoints;
                }
            });

            return {
                ...participant,
                score,
                pointsEarned
            };
        });

        return scores.sort((a, b) => b.score - a.score);
    };

    if (!quiz) return null;

    const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];
    const currentAnswers = sessionState.answers.filter(a => a.questionId === currentQuestion.id);

    // RANKING SCREEN - End of quiz
    if (showRanking) {
        // Calculate max score for bar width normalization
        const maxScore = Math.max(...animatedParticipants.map(p => p.score), 1);

        // Sorting the display list for absolute positioning
        const displayList = [...animatedParticipants].sort((a, b) => {
            if (rankingAnimationStage === 'initial' || rankingAnimationStage === 'filling') {
                return (b.score - b.pointsEarned) - (a.score - a.pointsEarned);
            }
            return b.score - a.score;
        });

        const colors = [
            'bg-blue-400', 'bg-red-500', 'bg-emerald-400', 'bg-indigo-400',
            'bg-purple-500', 'bg-yellow-400', 'bg-cyan-400', 'bg-orange-500',
            'bg-violet-400', 'bg-emerald-500'
        ];

        return (
            <div className="min-h-screen bg-[#f1f4f9] p-8 overflow-hidden">
                <div className="max-w-5xl mx-auto h-[calc(100vh-100px)] flex flex-col">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <Link href="/" className="flex items-center gap-2 group transition-all hover:opacity-80">
                            <span className="text-3xl text-indigo-500">🥕</span>
                            <span className="text-xl font-bold text-gray-900 tracking-tight">my karrot</span>
                        </Link>
                    </div>
                    <div className="text-center mb-10">
                        <h2 className="text-4xl font-bold text-gray-900 mb-2">Final Results</h2>
                        <p className="text-gray-500 text-lg font-light">Congratulations to everyone!</p>
                    </div>

                    <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 pb-12 custom-scrollbar relative">
                        <div className="relative" style={{ height: animatedParticipants.length * 70 }}>
                            {animatedParticipants.map((p) => {
                                const currentIndex = displayList.findIndex(item => item.id === p.id);
                                const isFilling = rankingAnimationStage === 'filling' || rankingAnimationStage === 'sorting' || rankingAnimationStage === 'done';
                                const currentDisplayScore = isFilling ? p.score : (p.score - p.pointsEarned);
                                const width = Math.max((currentDisplayScore / maxScore) * 100, 15);
                                const colorClass = colors[animatedParticipants.indexOf(p) % colors.length];

                                return (
                                    <div
                                        key={p.id}
                                        className="absolute left-0 right-0 flex items-center group transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                        style={{ top: currentIndex * 70 }}
                                    >
                                        {/* Score Label */}
                                        <div className="w-32 text-right pr-6 font-black text-3xl text-indigo-600 tabular-nums">
                                            {currentDisplayScore} <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter block -mt-1">points</span>
                                        </div>

                                        {/* Bar Container */}
                                        <div className="flex-1">
                                            <div
                                                className={`h-14 flex items-center justify-between px-6 transition-all duration-1000 ease-out relative group-hover:scale-[1.01] ${currentDisplayScore >= 0
                                                    ? `${colorClass} rounded-r-full shadow-lg border-y-2 border-r-2 border-white/20`
                                                    : ''
                                                    }`}
                                                style={{
                                                    width: `${width}%`,
                                                }}
                                            >
                                                <div className="flex items-center gap-3 whitespace-nowrap overflow-visible">
                                                    <div className="text-3xl drop-shadow-sm">{p.avatar}</div>
                                                    <span className={`font-bold text-xl tracking-tight ${currentDisplayScore >= 0 ? 'text-white' : 'text-gray-400'}`}>{p.name}</span>
                                                </div>
                                                {rankingAnimationStage === 'filling' && p.pointsEarned > 0 && (
                                                    <div className="absolute -right-16 bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-xs font-black shadow-lg animate-bounce animate-in zoom-in">
                                                        +{p.pointsEarned}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-10 mt-auto border-t border-gray-200">
                        <button
                            onClick={handleFinishQuiz}
                            className="flex-1 py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-xl transition-all shadow-xl hover:shadow-2xl active:scale-[0.98]"
                        >
                            Finish presentation
                        </button>
                        <button
                            onClick={handleDownloadResults}
                            className="px-10 py-5 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl font-bold text-xl transition-all shadow-md border-2 border-gray-100"
                        >
                            Save Results
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // LOBBY SCREEN - Before quiz starts
    if (!sessionState.hasStarted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100">
                <div className="bg-white/60 backdrop-blur-md border-b border-gray-200/50 py-4 px-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <Link href="/" className="flex items-center gap-2 group transition-all hover:opacity-80">
                                <span className="text-2xl sm:text-3xl">🥕</span>
                                <span className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">my karrot</span>
                            </Link>

                            <div className="w-[1px] h-8 bg-gray-200" />

                            <div>
                                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{quiz.title}</h1>
                                <p className="text-sm text-gray-500 font-light">
                                    Waiting to start • {quiz.questions.length} questions
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-medium tracking-wide mb-2">ROOM CODE</div>
                            <button
                                onClick={() => handleCopy(roomCode, 'code')}
                                className={`group relative text-3xl font-light tracking-[0.3em] px-6 py-3 rounded-2xl shadow-sm border transition-all ${copiedLink === 'code' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-900 hover:border-indigo-400'
                                    }`}
                            >
                                {roomCode}
                                <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none ${copiedLink === 'code' ? 'opacity-100' : ''
                                    }`}>
                                    {copiedLink === 'code' ? 'Copied!' : 'Click to copy'}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-8">
                    <div className="mb-12">
                        <h2 className="text-4xl font-semibold text-gray-900 mb-2">Waiting for participants</h2>
                        <p className="text-lg text-gray-500 font-light">
                            Share the code or scan to join instantly
                        </p>
                    </div>

                    <div className="grid grid-cols-12 gap-8 items-start">
                        {/* Participants List - Left Column */}
                        <div className="col-span-8 space-y-8">
                            <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] shadow-sm border border-gray-100 p-10 min-h-[450px] flex flex-col">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-semibold text-gray-900">
                                        Participants ({sessionState.participants.length})
                                    </h3>
                                </div>

                                <div className="flex-1">
                                    {sessionState.participants.length > 0 ? (
                                        <div className="flex flex-wrap gap-6 justify-center items-center py-10">
                                            {sessionState.participants.map((participant) => (
                                                <div key={participant.id} className="flex flex-col items-center gap-3 animate-in zoom-in-50 duration-300">
                                                    <div className="text-7xl drop-shadow-sm">{participant.avatar}</div>
                                                    <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate text-center bg-white px-3 py-1 rounded-full shadow-sm">
                                                        {participant.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                            <p className="text-gray-900 font-medium text-xl">Waiting for people to join...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <button
                                        onClick={handleStartQuiz}
                                        disabled={sessionState.participants.length === 0}
                                        className={`w-full py-5 rounded-2xl font-medium text-lg transition-all shadow-sm ${sessionState.participants.length > 0
                                            ? 'bg-indigo-500 hover:bg-indigo-600 text-white hover:shadow-md active:scale-[0.98]'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        Start presentation
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-50/50 border border-blue-100/50 rounded-3xl p-6">
                                <h4 className="font-semibold text-blue-900 mb-3 text-sm tracking-wide">NEXT STEPS</h4>
                                <ul className="flex gap-8 text-sm text-blue-800">
                                    <li>• Participants join using the code</li>
                                    <li>• Click "Start" when everyone arrives</li>
                                    <li>• Navigate via arrows or keyboard</li>
                                </ul>
                            </div>
                        </div>

                        {/* QR Code & Join Info - Right Column */}
                        <div className="col-span-4 space-y-6">
                            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8 flex flex-col items-center text-center">
                                <div className="w-full text-xs font-bold text-gray-400 tracking-widest uppercase mb-6">Scan to join</div>
                                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 mb-6 group transition-transform hover:scale-105">
                                    <QRCodeSVG
                                        value={`https://mykarrot.netlify.app/join/${roomCode}`}
                                        size={200}
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>
                                <div className="space-y-4 w-full">
                                    <button
                                        onClick={() => handleCopy(`https://mykarrot.netlify.app/join/${roomCode}`, 'direct')}
                                        className="w-full text-left group/copy relative"
                                    >
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Join via URL</div>
                                        <div className={`text-indigo-600 font-semibold break-all text-sm px-4 py-2 rounded-xl transition-all border-2 ${copiedLink === 'direct' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-indigo-50 border-transparent group-hover/copy:border-indigo-200'
                                            }`}>
                                            {copiedLink === 'direct' ? '✓ Copied to clipboard!' : `mykarrot.netlify.app/join/${roomCode}`}
                                        </div>
                                    </button>

                                    <div className="pt-4 border-t border-gray-100 w-full">
                                        <button
                                            onClick={() => handleCopy('https://mykarrot.netlify.app', 'base')}
                                            className="group/copy w-full"
                                        >
                                            <p className="text-sm text-gray-500 font-light mb-1">Enter room code manually at</p>
                                            <div className={`font-medium transition-all inline-block px-3 py-1 rounded-lg ${copiedLink === 'base' ? 'bg-green-50 text-green-600' : 'text-gray-700 group-hover/copy:bg-gray-100'
                                                }`}>
                                                {copiedLink === 'base' ? '✓ Link copied!' : 'mykarrot.netlify.app'}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Countdown Overlay */}
                {isCountingDown && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-xl transition-all duration-500 animate-in fade-in">
                        <div className="text-center">
                            <div className="text-[12rem] font-black text-indigo-600 animate-bounce tracking-tighter tabular-nums drop-shadow-2xl">
                                {countdownValue}
                            </div>
                            <p className="text-2xl font-medium text-indigo-900/40 tracking-widest uppercase -mt-4">
                                Prepare settings...
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // QUIZ SCREEN - After quiz has started
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100">
            <div className="bg-white/60 backdrop-blur-md border-b border-gray-200/50 py-4 px-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center gap-2 group transition-all hover:opacity-80">
                            <span className="text-2xl sm:text-3xl">🥕</span>
                            <span className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">my karrot</span>
                        </Link>

                        <div className="w-[1px] h-8 bg-gray-200" />

                        <div>
                            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{quiz.title}</h1>
                            <p className="text-sm text-gray-500 font-light mt-1">
                                Question {sessionState.currentQuestionIndex + 1} of {quiz.questions.length}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 font-medium tracking-wide mb-2">ROOM CODE</div>
                        <button
                            onClick={() => handleCopy(roomCode, 'code')}
                            className={`group relative text-3xl font-light tracking-[0.3em] px-6 py-3 rounded-2xl shadow-sm border transition-all ${copiedLink === 'code' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-900 hover:border-indigo-400'
                                }`}
                        >
                            {roomCode}
                            <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none ${copiedLink === 'code' ? 'opacity-100' : ''
                                }`}>
                                {copiedLink === 'code' ? 'Copied!' : 'Click to copy'}
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-6">
                        {showResults ? (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 min-h-[600px] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
                                <div className={`text-center transition-all duration-1000 ease-in-out ${showLeaderboard ? 'mb-12 scale-75 -translate-y-12' : 'mb-0 scale-110'}`}>
                                    <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">Question Results</h2>
                                    <h1 className="text-3xl font-semibold text-gray-900 leading-tight mb-8">{currentQuestion.question}</h1>

                                    {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'multiple-select' || currentQuestion.type === 'ranking') && (
                                        <div className="inline-block px-10 py-5 bg-green-50 border-2 border-green-100 rounded-[2.5rem] shadow-sm">
                                            <span className="text-xs font-bold text-green-500 uppercase tracking-widest block mb-2">Correct Answer</span>
                                            <span className="text-2xl font-black text-green-600">
                                                {currentQuestion.type === 'multiple-choice'
                                                    ? currentQuestion.options?.[currentQuestion.correctAnswer!]
                                                    : currentQuestion.type === 'multiple-select'
                                                        ? currentQuestion.correctAnswers?.map(idx => currentQuestion.options?.[idx]).join(', ')
                                                        : currentQuestion.correctOrder?.map((idx, i) => `${i + 1}. ${currentQuestion.options?.[idx]}`).join(', ')
                                                }
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className={`w-full space-y-4 transition-all duration-1000 ease-out ${showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 h-0 pointer-events-none'}`}>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-2">Current Standings</h3>
                                    <div className="relative" style={{ height: `${sessionState.participants.length * 72}px` }}>
                                        {calculateScores().map((participant, index) => (
                                            <div
                                                key={participant.id}
                                                className="absolute w-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                                style={{ top: `${index * 72}px` }}
                                            >
                                                <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100 shadow-sm mx-2">
                                                    <div className="flex items-center gap-4">
                                                        <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                                            index === 1 ? 'bg-slate-300 text-slate-700' :
                                                                index === 2 ? 'bg-orange-300 text-orange-800' :
                                                                    'bg-gray-200 text-gray-500'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-3xl">{participant.avatar}</span>
                                                        <span className="font-semibold text-gray-800">{participant.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-indigo-600 tabular-nums">{participant.score}</div>
                                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Points</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12">
                                <div className="mb-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium tracking-wide">
                                            {currentQuestion.type.replace('-', ' ').toUpperCase()}
                                        </span>
                                        {timeLeft !== null && (
                                            <div className="flex items-center gap-3">
                                                <div className={`text-5xl font-mono font-bold tracking-tighter tabular-nums px-6 py-3 bg-white rounded-2xl shadow-sm border-2 ${timeLeft <= 5 ? 'text-red-500 border-red-100 animate-pulse' : 'text-indigo-600 border-indigo-50'}`}>
                                                    {timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                                                    <span className="text-xl ml-1 opacity-50">s</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-semibold text-gray-900 leading-tight">{currentQuestion.question}</h2>
                                </div>

                                {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'multiple-select') && currentQuestion.options && (
                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                        {currentQuestion.options.map((option, idx) => {
                                            const answerCount = currentAnswers.filter(a => {
                                                if (Array.isArray(a.answer)) {
                                                    return a.answer.includes(idx);
                                                }
                                                return a.answer === idx;
                                            }).length;

                                            const percentage = currentAnswers.length > 0 ? (answerCount / currentAnswers.length) * 100 : 0;
                                            return (
                                                <div key={idx} className="relative bg-gray-50 rounded-2xl p-6 overflow-hidden border border-gray-100">
                                                    <div className="absolute inset-0 bg-indigo-100 transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%` }} />
                                                    <div className="relative flex justify-between items-center">
                                                        <span className="font-medium text-lg text-gray-900">{option}</span>
                                                        <span className="text-2xl font-semibold text-indigo-600">{answerCount}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {currentQuestion.type === 'word-cloud' && (
                                    <div className="mt-8 bg-gray-50 rounded-2xl p-8 min-h-[200px] border border-gray-100">
                                        <div className="flex flex-wrap gap-3 justify-center items-center">
                                            {currentAnswers.map((answer, idx) => (
                                                <span key={idx} className="inline-block px-4 py-2 bg-white text-indigo-600 rounded-xl font-medium shadow-sm border border-gray-100" style={{ fontSize: `${Math.random() * 1 + 1}rem` }}>
                                                    {answer.answer}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {currentQuestion.type === 'open-ended' && (
                                    <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                        {currentAnswers.map((answer, idx) => (
                                            <div key={idx} className="bg-blue-50/30 rounded-2xl p-6 border border-blue-100 flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-blue-50">
                                                    {sessionState.participants.find(p => p.id === answer.participantId)?.avatar || '👤'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">{answer.participantName}</div>
                                                    <div className="text-lg text-gray-900 font-medium leading-relaxed">{answer.answer}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {currentQuestion.type === 'q-and-a' && (
                                    <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Audience Questions</h3>
                                            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg font-bold">{currentAnswers.length} Questions</span>
                                        </div>
                                        {currentAnswers.map((answer, idx) => (
                                            <div key={idx} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-all group">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shadow-inner">
                                                    {sessionState.participants.find(p => p.id === answer.participantId)?.avatar || '❓'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{answer.participantName}</span>
                                                        <span className="text-[10px] text-gray-300 font-medium">{new Date(answer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="text-xl text-gray-900 font-semibold mt-1 group-hover:text-indigo-900 transition-colors">{answer.answer}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {currentAnswers.length === 0 && (
                                            <div className="py-20 text-center opacity-30 italic text-gray-500">No questions yet...</div>
                                        )}
                                    </div>
                                )}

                                {currentQuestion.type === 'scales' && (
                                    <div className="mt-8 space-y-12">
                                        <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
                                            {(() => {
                                                const total = currentAnswers.reduce((sum, a) => sum + (typeof a.answer === 'number' ? a.answer : 0), 0);
                                                const avg = currentAnswers.length > 0 ? total / currentAnswers.length : 0;
                                                return (
                                                    <div className="space-y-6">
                                                        <div className="flex justify-between items-end">
                                                            <div className="flex flex-col">
                                                                <span className="text-4xl font-black text-indigo-600 tracking-tighter">{avg.toFixed(1)}</span>
                                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Average Score</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{currentAnswers.length} responses</span>
                                                            </div>
                                                        </div>
                                                        <div className="relative h-12 bg-gray-100 rounded-3xl p-1 overflow-hidden shadow-inner border border-gray-200">
                                                            {(() => {
                                                                const min = currentQuestion.scaleMin ?? 1;
                                                                const max = currentQuestion.scaleMax ?? 10;
                                                                const percentage = max > min ? ((avg - min) / (max - min)) * 100 : 0;
                                                                return (
                                                                    <div className="absolute inset-y-1 left-1 bg-indigo-500 rounded-2xl transition-all duration-1000 ease-out flex items-center justify-end px-4" style={{ width: `calc(${percentage}% - 8px)` }}>
                                                                        {avg > min && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-sm"></div>}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <div className="absolute inset-0 flex justify-between px-6 items-center pointer-events-none">
                                                                <span className="text-[10px] font-black text-gray-400">{currentQuestion.scaleLabels?.min || 'Low'}</span>
                                                                <span className="text-[10px] font-black text-gray-400">{currentQuestion.scaleLabels?.max || 'High'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {currentQuestion.type === 'ranking' && (
                                    <div className="mt-8 grid grid-cols-1 gap-4 max-w-2xl mx-auto">
                                        {(() => {
                                            const scores = currentQuestion.options?.map((_, idx) => {
                                                const rankings = currentAnswers
                                                    .filter(a => Array.isArray(a.answer))
                                                    .map(a => (a.answer as unknown as number[]).indexOf(idx));

                                                // Score formula: points for each position (higher points for 1st place)
                                                // If option.length = 3, 1st = 3pts, 2nd = 2pts, 3rd = 1pt
                                                const totalScore = rankings.reduce((sum, pos) => {
                                                    if (pos === -1) return sum;
                                                    return sum + (currentQuestion.options!.length - pos);
                                                }, 0);

                                                return { idx, score: totalScore };
                                            }).sort((a, b) => b.score - a.score);

                                            const maxScore = scores ? Math.max(...scores.map(s => s.score), 1) : 1;

                                            return scores?.map((s, i) => (
                                                <div key={s.idx} className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between overflow-hidden group">
                                                    <div className="absolute inset-y-0 left-0 bg-indigo-50 transition-all duration-1000" style={{ width: `${(s.score / maxScore) * 100}%` }} />
                                                    <div className="relative flex items-center gap-4 flex-1">
                                                        <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg font-black text-sm shadow-sm">{i + 1}</span>
                                                        <span className="font-semibold text-lg text-gray-800">{currentQuestion.options![s.idx]}</span>
                                                    </div>
                                                    <div className="relative text-xs font-bold text-indigo-400 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full">{s.score} points</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={handlePreviousQuestion} disabled={sessionState.currentQuestionIndex === 0 || showResults} className="px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-2xl font-medium text-gray-700 disabled:text-gray-400 transition-all shadow-sm border border-gray-200">
                                Previous
                            </button>
                            {sessionState.currentQuestionIndex === quiz.questions.length - 1 && showResults ? (
                                <button onClick={handleShowRanking} className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium transition-all shadow-sm">
                                    Final Ranking
                                </button>
                            ) : (
                                <button onClick={handleNextQuestion} className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium transition-all shadow-sm">
                                    {showResults ? 'Next question' : 'Show results'}
                                </button>
                            )}
                            <button onClick={handleDownloadResults} className="px-6 py-3 bg-white hover:bg-gray-50 rounded-2xl font-medium text-gray-700 transition-all shadow-sm border border-gray-200">
                                Save Results
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6">Participants ({sessionState.participants.length})</h3>

                            <div className="flex flex-wrap gap-3 mb-6 min-h-[120px] justify-center items-center">
                                {sessionState.participants.map((participant) => {
                                    const hasAnswered = currentAnswers.some(a => a.participantId === participant.id);
                                    return (
                                        <div key={participant.id} className="relative group" title={participant.name}>
                                            <div className={`text-5xl transition-all ${hasAnswered ? 'opacity-100 scale-110' : 'opacity-40'}`}>
                                                {participant.avatar}
                                            </div>
                                            {hasAnswered && (
                                                <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                            )}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                                                {participant.name}
                                            </div>
                                        </div>
                                    );
                                })}
                                {sessionState.participants.length === 0 && (
                                    <p className="text-gray-400 text-center py-8 w-full text-sm font-light">Waiting for participants to join...</p>
                                )}
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {sessionState.participants.map((participant) => {
                                    const hasAnswered = currentAnswers.some(a => a.participantId === participant.id);
                                    return (
                                        <div key={participant.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-sm border border-gray-100">
                                            <span className="text-2xl">{participant.avatar}</span>
                                            <span className="font-medium flex-1 truncate text-gray-700">{participant.name}</span>
                                            {hasAnswered && <span className="text-green-500 text-xs">✓</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stats</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-light">Responses</span>
                                    <span className="text-2xl font-semibold text-gray-900">{currentAnswers.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-light">Response Rate</span>
                                    <span className="text-2xl font-semibold text-gray-900">
                                        {sessionState.participants.length > 0 ? Math.round((currentAnswers.length / sessionState.participants.length) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Removed Bottom Progress Bar as requested */}
        </div>
    );
}
