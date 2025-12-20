'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Peer, { DataConnection } from 'peerjs';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { getRandomAvatar } from '@/lib/avatars';
import confetti from 'canvas-confetti';

export default function JoinPage() {
    const params = useParams();
    const router = useRouter();
    const roomCode = params.code as string;

    const [step, setStep] = useState<'name' | 'waiting' | 'quiz' | 'ranking'>('name');
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState('');
    const [peer, setPeer] = useState<Peer | null>(null);
    const [connection, setConnection] = useState<DataConnection | null>(null);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | number | number[] | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [isCountingDown, setIsCountingDown] = useState(false); // Added
    const [countdownValue, setCountdownValue] = useState(7); // Added
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null); // Added
    const [error, setError] = useState('');

    const handleJoin = () => {
        if (!name.trim()) return;

        // Generate random avatar
        const randomAvatar = getRandomAvatar();
        setAvatar(randomAvatar);

        // Create peer with random ID
        const newPeer = new Peer();

        newPeer.on('open', (id) => {
            console.log('Participant peer ID:', id);

            // Connect to host
            const conn = newPeer.connect(roomCode.toUpperCase());

            conn.on('open', () => {
                console.log('Connected to host');

                // Send join message with avatar
                conn.send({
                    type: 'JOIN',
                    payload: {
                        name: name.trim(),
                        avatar: randomAvatar
                    }
                });

                setConnection(conn);
                setStep('waiting');
            });

            conn.on('data', (data: any) => {
                handleHostMessage(data);
            });

            conn.on('close', () => {
                setError('Connection to host lost');
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                setError('Failed to connect to room. Please check the code.');
            });
        });

        newPeer.on('error', (err) => {
            console.error('Peer error:', err);
            setError('Failed to join room. Please try again.');
        });

        setPeer(newPeer);
    };

    const handleHostMessage = (data: any) => {
        switch (data.type) {
            case 'QUIZ_DATA':
                setQuiz(data.payload.quiz);
                setCurrentQuestionIndex(data.payload.currentQuestionIndex);
                setTimeLeft(data.payload.timeLeft);
                // Only show quiz if it has started
                if (data.payload.hasStarted) {
                    setStep('quiz');
                }
                setHasAnswered(false);
                setSelectedAnswer(null);
                setIsTimeUp(false);
                break;

            case 'QUIZ_STARTED':
                setStep('quiz');
                setIsCountingDown(false);
                if (data.payload.timeLeft) {
                    setTimeLeft(data.payload.timeLeft);
                }
                break;

            case 'QUIZ_STARTING': // Added
                setIsCountingDown(true);
                setCountdownValue(data.payload.countdown || 7);
                break;

            case 'TIME_UP':
                setIsTimeUp(true);
                break;

            case 'NEXT_QUESTION':
                setCurrentQuestionIndex(data.payload.questionIndex);
                setTimeLeft(data.payload.timeLeft);
                setHasAnswered(false);
                setSelectedAnswer(null);
                setIsTimeUp(false);
                break;

            case 'SHOW_RANKING':
                setStep('ranking');
                // Celebration for participants too!
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#6366f1', '#a855f7', '#ec4899']
                });
                break;

            case 'QUIZ_ENDED':
                peer?.destroy();
                router.push('/');
                break;
        }
    };

    const handleSubmitAnswer = () => {
        if (!connection || !quiz || selectedAnswer === null) return;

        const currentQuestion = quiz.questions[currentQuestionIndex];

        connection.send({
            type: 'ANSWER',
            payload: {
                name,
                questionId: currentQuestion.id,
                answer: selectedAnswer
            }
        });

        setHasAnswered(true);
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 'quiz' && timeLeft !== null && timeLeft > 0 && !isTimeUp) {
            timer = setTimeout(() => {
                setTimeLeft(prev => (prev !== null ? prev - 1 : null));
            }, 1000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [step, timeLeft, isTimeUp]);

    // Countdown logic
    useEffect(() => {
        if (isCountingDown && countdownValue > 0) {
            countdownTimerRef.current = setTimeout(() => {
                setCountdownValue(prev => prev - 1);
            }, 1000);
        }

        return () => {
            if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
        };
    }, [isCountingDown, countdownValue]);

    useEffect(() => {
        return () => {
            peer?.destroy();
        };
    }, [peer]);

    if (!roomCode || roomCode.length !== 6) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Room Code</h2>
                    <p className="text-gray-600 mb-6">The room code must be exactly 6 characters.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Name Entry Step
    if (step === 'name') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-10 max-w-md w-full">
                    <div className="text-center mb-8 space-y-3">
                        <div className="text-5xl mb-4">🥕</div>
                        <h2 className="text-3xl font-semibold text-gray-900">Join presentation</h2>
                        <p className="text-gray-500 font-light">Room: <span className="font-medium tracking-wider">{roomCode}</span></p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label htmlFor="name" className="block text-xs font-medium text-gray-600 tracking-wide mb-3">
                                YOUR NAME
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                                placeholder="Enter your name"
                                className="w-full px-5 py-4 bg-gray-50 border-0 rounded-2xl text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                                maxLength={30}
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleJoin}
                            disabled={!name.trim()}
                            className={`w-full py-4 rounded-2xl font-medium transition-all ${name.trim()
                                ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Join
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Waiting Step
    if (step === 'waiting') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="mb-12">
                        <div className="inline-block animate-bounce text-9xl mb-6">{avatar}</div>
                        <h2 className="text-4xl font-semibold text-gray-900 mb-3">Welcome, {name}!</h2>
                        <p className="text-lg text-gray-500 font-light">Waiting for the presentation to start...</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
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
                                Get ready...
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Ranking Step
    if (step === 'ranking') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 flex items-center justify-center p-6 text-center">
                <div className="space-y-6">
                    <h2 className="text-4xl font-semibold text-gray-900">Quiz Complete!</h2>
                    <p className="text-xl text-gray-600 font-light">The host is reviewing the results.</p>
                    <div className="flex gap-2 justify-center mt-8">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz Step
    if (step === 'quiz' && quiz) {
        const currentQuestion = quiz.questions[currentQuestionIndex];

        if (hasAnswered && !isTimeUp) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
                    <div className="space-y-12 max-w-md">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl animate-pulse"></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-semibold text-gray-900 leading-tight">Great job!</h2>
                            <p className="text-xl text-gray-600 font-light px-4">
                                Your answer has been submitted. Please wait for the presenter to move to the next slide.
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center pt-8">
                            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 flex items-center justify-center p-6">
                <div className="max-w-2xl w-full">
                    {/* Progress */}
                    <div className="text-center mb-8">
                        <p className="text-sm text-gray-500 font-light mb-3">
                            Question {currentQuestionIndex + 1} of {quiz.questions.length}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Digital Timer */}
                    {timeLeft !== null && (
                        <div className="flex justify-center mb-8">
                            <div className={`text-6xl font-mono font-bold tracking-tighter tabular-nums px-8 py-4 bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border-2 transition-all ${timeLeft <= 5 ? 'text-red-500 border-red-100 animate-pulse scale-105' : 'text-indigo-600 border-indigo-50'}`}>
                                {isTimeUp ? "00" : (timeLeft < 10 ? `0${timeLeft}` : timeLeft)}
                                <span className="text-2xl ml-1 opacity-50">s</span>
                            </div>
                        </div>
                    )}

                    {/* Question Card */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-10 mb-6">
                        <h2 className="text-3xl font-semibold text-gray-900 mb-10 leading-tight">{currentQuestion.question}</h2>

                        {/* Multiple Choice & Multiple Select */}
                        {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'multiple-select') && currentQuestion.options && (
                            <div className="space-y-3">
                                {currentQuestion.type === 'multiple-select' && (
                                    <p className="text-xs text-indigo-400 font-medium italic mb-2">Select all that apply</p>
                                )}
                                {currentQuestion.options.map((option, idx) => {
                                    const isSelected = currentQuestion.type === 'multiple-select'
                                        ? (Array.isArray(selectedAnswer) && selectedAnswer.includes(idx))
                                        : selectedAnswer === idx;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (hasAnswered || isTimeUp) return;
                                                if (currentQuestion.type === 'multiple-select') {
                                                    const current = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
                                                    const exists = current.indexOf(idx);
                                                    if (exists > -1) {
                                                        current.splice(exists, 1);
                                                    } else {
                                                        current.push(idx);
                                                    }
                                                    setSelectedAnswer(current);
                                                } else {
                                                    setSelectedAnswer(idx);
                                                }
                                            }}
                                            disabled={hasAnswered || isTimeUp}
                                            className={`w-full p-5 rounded-2xl font-medium text-left transition-all border flex items-center justify-between ${isSelected
                                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-[1.02]'
                                                : 'bg-gray-50 text-gray-900 border-gray-100 hover:bg-gray-100'
                                                } ${hasAnswered || isTimeUp ? 'cursor-not-allowed opacity-60' : ''}`}
                                        >
                                            <span>{option}</span>
                                            {currentQuestion.type === 'multiple-select' && (
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-white/20 border-white text-white'
                                                    : 'bg-white border-gray-300 text-transparent'
                                                    }`}>
                                                    <span className="text-[10px]">✓</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Word Cloud / Open Ended / Q&A */}
                        {(currentQuestion.type === 'word-cloud' || currentQuestion.type === 'open-ended' || currentQuestion.type === 'q-and-a') && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <textarea
                                    value={selectedAnswer as string || ''}
                                    onChange={(e) => setSelectedAnswer(e.target.value)}
                                    disabled={hasAnswered || isTimeUp}
                                    placeholder={
                                        isTimeUp ? "Time is up!" :
                                            currentQuestion.type === 'q-and-a' ? "Type your question for the presenter..." :
                                                "Type your answer..."
                                    }
                                    className="w-full px-5 py-4 bg-gray-50 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all resize-none text-gray-900 placeholder:text-gray-300 min-h-[120px]"
                                    maxLength={currentQuestion.type === 'word-cloud' ? 50 : 500}
                                />
                            </div>
                        )}

                        {/* Scales */}
                        {currentQuestion.type === 'scales' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
                                <div className="flex justify-between text-xs font-bold text-gray-600 uppercase tracking-widest px-1">
                                    <span>{currentQuestion.scaleLabels?.min || 'Low'}</span>
                                    <span>{currentQuestion.scaleLabels?.max || 'High'}</span>
                                </div>
                                <div className="relative h-12 flex items-center">
                                    <input
                                        type="range"
                                        min={currentQuestion.scaleMin ?? 1}
                                        max={currentQuestion.scaleMax ?? 10}
                                        step="1"
                                        value={selectedAnswer as number ?? Math.round(((currentQuestion.scaleMax ?? 10) + (currentQuestion.scaleMin ?? 1)) / 2)}
                                        onChange={(e) => setSelectedAnswer(parseInt(e.target.value))}
                                        disabled={hasAnswered || isTimeUp}
                                        className="w-full h-2 bg-indigo-50 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                                    />
                                    <div className="absolute top-10 left-0 right-0 flex justify-between px-1">
                                        {Array.from({ length: (currentQuestion.scaleMax ?? 10) - (currentQuestion.scaleMin ?? 1) + 1 }, (_, i) => (currentQuestion.scaleMin ?? 1) + i).map(val => (
                                            <span key={val} className={`text-[10px] font-bold ${(selectedAnswer ?? Math.round(((currentQuestion.scaleMax ?? 10) + (currentQuestion.scaleMin ?? 1)) / 2)) === val ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                {val}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Ranking */}
                        {currentQuestion.type === 'ranking' && currentQuestion.options && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <p className="text-xs text-indigo-400 font-medium italic mb-2">Tap to set priority (1 to {currentQuestion.options.length})</p>
                                {currentQuestion.options.map((option, idx) => {
                                    const rank = Array.isArray(selectedAnswer) ? selectedAnswer.indexOf(idx) + 1 : 0;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (hasAnswered || isTimeUp) return;
                                                const currentSelection = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
                                                const existingIdx = currentSelection.indexOf(idx);
                                                if (existingIdx > -1) {
                                                    currentSelection.splice(existingIdx, 1);
                                                } else {
                                                    currentSelection.push(idx);
                                                }
                                                setSelectedAnswer(currentSelection as any);
                                            }}
                                            disabled={hasAnswered || isTimeUp}
                                            className={`w-full p-5 rounded-2xl font-medium text-left transition-all border flex items-center justify-between ${rank > 0
                                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-[1.02]'
                                                : 'bg-gray-50 text-gray-900 border-gray-100 hover:bg-gray-100'
                                                } ${hasAnswered || isTimeUp ? 'cursor-not-allowed opacity-60' : ''}`}
                                        >
                                            <span>{option}</span>
                                            {rank > 0 && (
                                                <span className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full font-bold text-sm">
                                                    {rank}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    {!hasAnswered ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={selectedAnswer === null || selectedAnswer === '' || isTimeUp}
                            className={`w-full py-5 rounded-2xl font-medium text-lg transition-all ${selectedAnswer !== null && selectedAnswer !== '' && !isTimeUp
                                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm hover:shadow-md'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isTimeUp ? "Time's Up!" : "Submit answer"}
                        </button>
                    ) : (
                        <div className="text-center bg-green-500 text-white py-5 rounded-2xl font-medium text-lg shadow-sm">
                            Answer submitted!
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
