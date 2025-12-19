'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Peer, { DataConnection } from 'peerjs';
import { Quiz, SessionState, ParticipantAnswer, Participant } from '@/types/quiz';

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
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

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

        newPeer.on('open', (id) => {
            console.log('Host peer ID:', id);
            setSessionState(prev => ({ ...prev, isActive: true, quizId: id }));
        });

        newPeer.on('connection', (conn) => {
            console.log('New participant connection:', conn.peer);

            conn.on('open', () => {
                // Send current quiz state to new participant
                conn.send({
                    type: 'QUIZ_DATA',
                    payload: {
                        quiz: parsedQuiz,
                        currentQuestionIndex: sessionState.currentQuestionIndex,
                        hasStarted: sessionState.hasStarted,
                        timeLeft: timeLeft
                    }
                });

                // Update connections map
                setConnections(prev => new Map(prev).set(conn.peer, conn));
            });

            conn.on('data', (data: any) => {
                handleParticipantMessage(conn.peer, data);
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

    // Timer logic
    useEffect(() => {
        if (sessionState.hasStarted && quiz) {
            const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];

            // Initialize timer if not already set for this question
            if (timeLeft === null) {
                setTimeLeft(currentQuestion.timeLimit || 30);
                return;
            }

            if (timeLeft > 0) {
                timerRef.current = setTimeout(() => {
                    setTimeLeft(prev => (prev !== null ? prev - 1 : null));
                }, 1000);
            } else if (timeLeft === 0) {
                broadcastToAll({
                    type: 'TIME_UP',
                    payload: { questionId: currentQuestion.id }
                });
            }
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [sessionState.hasStarted, sessionState.currentQuestionIndex, timeLeft, quiz]);

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
                    timestamp: Date.now()
                };
                setSessionState(prev => ({
                    ...prev,
                    answers: [...prev.answers, answer]
                }));
                break;
        }
    };

    const broadcastToAll = (message: any) => {
        connections.forEach((conn) => {
            if (conn.open) {
                conn.send(message);
            }
        });
    };

    const handleStartQuiz = () => {
        setSessionState(prev => ({ ...prev, hasStarted: true }));
        broadcastToAll({
            type: 'QUIZ_STARTED',
            payload: {}
        });
    };

    const handleNextQuestion = () => {
        if (!quiz) return;

        const nextIndex = sessionState.currentQuestionIndex + 1;
        if (nextIndex >= quiz.questions.length) return;

        setSessionState(prev => ({ ...prev, currentQuestionIndex: nextIndex }));
        setTimeLeft(null); // Reset timer for next question

        broadcastToAll({
            type: 'NEXT_QUESTION',
            payload: {
                questionIndex: nextIndex,
                timeLeft: quiz.questions[nextIndex].timeLimit || 30
            }
        });
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
        setShowRanking(true);
        broadcastToAll({
            type: 'SHOW_RANKING',
            payload: {}
        });
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
            quiz.questions.forEach(question => {
                if (question.type === 'multiple-choice') {
                    const participantAnswer = sessionState.answers.find(
                        a => a.participantId === participant.id && a.questionId === question.id
                    );
                    if (participantAnswer && participantAnswer.answer === question.correctAnswer) {
                        score += 1;
                    }
                }
            });
            return {
                ...participant,
                score
            };
        });

        return scores.sort((a, b) => b.score - a.score);
    };

    if (!quiz) return null;

    const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];
    const currentAnswers = sessionState.answers.filter(a => a.questionId === currentQuestion.id);

    // RANKING SCREEN - End of quiz
    if (showRanking) {
        const sortedParticipants = calculateScores();
        const top3 = sortedParticipants.slice(0, 3);
        const others = sortedParticipants.slice(3);

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-5xl mb-4 block">🏆</span>
                        <h2 className="text-4xl font-semibold text-gray-900 mb-2">Final Results</h2>
                        <p className="text-gray-500 font-light">Congratulations to everyone!</p>
                    </div>

                    {/* Podium */}
                    <div className="flex justify-center items-end gap-4 mb-12 min-h-[300px]">
                        {/* 2nd Place */}
                        {top3[1] && (
                            <div className="flex flex-col items-center group">
                                <div className="text-5xl mb-3 transition-transform group-hover:scale-110">{top3[1].avatar}</div>
                                <div className="text-sm font-medium text-gray-700 mb-2">{top3[1].name}</div>
                                <div className="w-32 bg-gray-200/50 backdrop-blur-sm border border-gray-100 rounded-t-2xl h-32 flex flex-col items-center justify-center shadow-sm">
                                    <span className="text-3xl font-bold text-gray-400">2</span>
                                    <span className="text-sm text-gray-500 font-medium">{top3[1].score} pts</span>
                                </div>
                            </div>
                        )}
                        {/* 1st Place */}
                        {top3[0] && (
                            <div className="flex flex-col items-center group -mt-8">
                                <div className="text-7xl mb-4 transition-transform group-hover:scale-110 drop-shadow-lg">{top3[0].avatar}</div>
                                <div className="text-lg font-bold text-gray-900 mb-2">{top3[0].name}</div>
                                <div className="w-40 bg-indigo-500 rounded-t-3xl h-48 flex flex-col items-center justify-center shadow-xl border-x-4 border-t-4 border-indigo-400">
                                    <span className="text-5xl font-black text-white">1</span>
                                    <span className="text-md text-indigo-100 font-semibold">{top3[0].score} pts</span>
                                </div>
                            </div>
                        )}
                        {/* 3rd Place */}
                        {top3[2] && (
                            <div className="flex flex-col items-center group">
                                <div className="text-5xl mb-3 transition-transform group-hover:scale-110">{top3[2].avatar}</div>
                                <div className="text-sm font-medium text-gray-700 mb-2">{top3[2].name}</div>
                                <div className="w-32 bg-orange-100/50 backdrop-blur-sm border border-orange-50 rounded-t-2xl h-24 flex flex-col items-center justify-center shadow-sm">
                                    <span className="text-2xl font-bold text-orange-400">3</span>
                                    <span className="text-sm text-orange-500 font-medium">{top3[2].score} pts</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Other positions */}
                    {others.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
                            <div className="space-y-2">
                                {others.map((p, i) => (
                                    <div key={p.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-white hover:border-indigo-100">
                                        <span className="w-8 text-center font-bold text-gray-400">{i + 4}</span>
                                        <span className="text-2xl">{p.avatar}</span>
                                        <span className="flex-1 font-medium text-gray-700">{p.name}</span>
                                        <span className="font-semibold text-gray-900">{p.score} pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={handleFinishQuiz}
                            className="flex-1 py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-medium text-lg transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                        >
                            Finish presentation
                        </button>
                        <button
                            onClick={handleDownloadResults}
                            className="px-8 py-5 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl font-medium text-lg transition-all shadow-sm border border-gray-200"
                        >
                            📥 Save Results
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
                <div className="bg-white/60 backdrop-blur-md border-b border-gray-200/50 py-6 px-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">{quiz.title}</h1>
                            <p className="text-sm text-gray-500 font-light mt-1">
                                Waiting to start • {quiz.questions.length} questions
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-medium tracking-wide mb-2">ROOM CODE</div>
                            <div className="text-3xl font-light tracking-[0.3em] text-gray-900 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                                {roomCode}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto p-8">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-semibold text-gray-900 mb-4">Waiting for participants</h2>
                        <p className="text-lg text-gray-500 font-light">Share the room code with your audience</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-10 mb-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-semibold text-gray-900">
                                Participants ({sessionState.participants.length})
                            </h3>
                        </div>

                        {sessionState.participants.length > 0 ? (
                            <>
                                <div className="flex flex-wrap gap-6 justify-center mb-10 min-h-[150px] items-center">
                                    {sessionState.participants.map((participant) => (
                                        <div key={participant.id} className="flex flex-col items-center gap-3">
                                            <div className="text-7xl">{participant.avatar}</div>
                                            <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate text-center">
                                                {participant.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleStartQuiz}
                                    className="w-full py-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium text-lg transition-all shadow-sm hover:shadow-md"
                                >
                                    Start presentation
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-20">
                                <div className="text-7xl mb-6">👋</div>
                                <p className="text-gray-400 font-light text-lg">Waiting for participants to join...</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                        <h4 className="font-semibold text-blue-900 mb-3 text-sm tracking-wide">💡 NEXT STEPS</h4>
                        <ul className="space-y-2 text-sm text-blue-800">
                            <li>• Participants can join using the room code</li>
                            <li>• Click "Start presentation" when everyone has joined</li>
                            <li>• You'll be able to navigate through questions and see responses</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // QUIZ SCREEN - After quiz has started
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100">
            <div className="bg-white/60 backdrop-blur-md border-b border-gray-200/50 py-6 px-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">{quiz.title}</h1>
                        <p className="text-sm text-gray-500 font-light mt-1">
                            Question {sessionState.currentQuestionIndex + 1} of {quiz.questions.length}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 font-medium tracking-wide mb-2">ROOM CODE</div>
                        <div className="text-3xl font-light tracking-[0.3em] text-gray-900 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
                            {roomCode}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12">
                            <div className="mb-8">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium tracking-wide">
                                        {currentQuestion.type.replace('-', ' ').toUpperCase()}
                                    </span>
                                    {timeLeft !== null && (
                                        <div className={`text-3xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-900'}`}>
                                            {timeLeft}s
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-4xl font-semibold text-gray-900 leading-tight">{currentQuestion.question}</h2>
                            </div>

                            {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    {currentQuestion.options.map((option, idx) => {
                                        const answerCount = currentAnswers.filter(a => a.answer === idx).length;
                                        const percentage = currentAnswers.length > 0 ? (answerCount / currentAnswers.length) * 100 : 0;
                                        return (
                                            <div key={idx} className="relative bg-gray-50 rounded-2xl p-6 overflow-hidden border border-gray-100">
                                                <div className="absolute inset-0 bg-indigo-100 transition-all duration-500" style={{ width: `${percentage}%` }} />
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
                                <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto">
                                    {currentAnswers.map((answer, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                            <div className="text-xs text-gray-500 font-medium mb-2">{answer.participantName}</div>
                                            <div className="text-gray-900">{answer.answer}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={handlePreviousQuestion} disabled={sessionState.currentQuestionIndex === 0} className="px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-2xl font-medium text-gray-700 disabled:text-gray-400 transition-all shadow-sm border border-gray-200">
                                ← Previous
                            </button>
                            {sessionState.currentQuestionIndex === quiz.questions.length - 1 ? (
                                <button onClick={handleShowRanking} className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium transition-all shadow-sm">
                                    Show results 🏆
                                </button>
                            ) : (
                                <button onClick={handleNextQuestion} className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium transition-all shadow-sm">
                                    Next question →
                                </button>
                            )}
                            <button onClick={handleDownloadResults} className="px-6 py-3 bg-white hover:bg-gray-50 rounded-2xl font-medium text-gray-700 transition-all shadow-sm border border-gray-200">
                                📥 Results
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

            {/* Timer Progress Bar */}
            {sessionState.hasStarted && timeLeft !== null && (
                <div className="w-full h-1.5 bg-gray-200 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-indigo-500'
                            }`}
                        style={{ width: `${(timeLeft / (currentQuestion.timeLimit || 30)) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
}
