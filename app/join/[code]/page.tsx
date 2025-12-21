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
    const [showResults, setShowResults] = useState(false);
    const [showBoard, setShowBoard] = useState(false);
    const [resultData, setResultData] = useState<{ isCorrect: boolean; correctAnswer?: any; leaderboard: any[] } | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(7);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [error, setError] = useState('');

    const handleJoin = () => {
        if (!name.trim()) return;

        const randomAvatar = getRandomAvatar();
        setAvatar(randomAvatar);

        const newPeer = new Peer();

        newPeer.on('open', (id) => {
            console.log('Participant peer ID:', id);

            const conn = newPeer.connect(roomCode.toUpperCase());

            conn.on('open', () => {
                console.log('Connected to host');
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
                hostMessageHandlerRef.current?.(data);
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

            case 'QUIZ_STARTING':
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
                setShowBoard(false);
                setShowResults(false);
                setResultData(null);
                setSelectedAnswer(null);
                setIsTimeUp(false);
                break;

            case 'SHOW_RESULTS':
                if (quiz) {
                    const currentQuestion = quiz.questions[currentQuestionIndex];
                    let isCorrect = false;

                    if (currentQuestion.type === 'multiple-choice') {
                        isCorrect = selectedAnswer === currentQuestion.correctAnswer;
                    } else if (currentQuestion.type === 'multiple-select') {
                        const correct = currentQuestion.correctAnswers || [];
                        const given = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                        isCorrect = correct.length === given.length && correct.every(v => given.includes(v));
                    } else if (currentQuestion.type === 'ranking') {
                        const correct = currentQuestion.correctOrder || [];
                        const given = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                        isCorrect = correct.length === given.length && correct.every((val, idx) => val === given[idx]);
                    }

                    setResultData({
                        isCorrect,
                        correctAnswer: data.payload.correctAnswer,
                        leaderboard: data.payload.leaderboard
                    });

                    setIsTimeUp(true);
                    setShowResults(true);
                    setTimeout(() => setShowBoard(true), 3000);
                }
                break;

            case 'SHOW_RANKING':
                setStep('ranking');
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

    const hostMessageHandlerRef = useRef<((data: any) => void) | null>(null);
    useEffect(() => {
        hostMessageHandlerRef.current = handleHostMessage;
    }, [handleHostMessage]);

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

    if (step === 'quiz' && quiz) {
        const currentQuestion = quiz.questions[currentQuestionIndex];

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Base Quiz Layer - Always visible */}
                <div className={`max-w-2xl w-full transition-all duration-700 ${showResults || (hasAnswered && !isTimeUp) ? 'blur-sm scale-[0.98] opacity-50' : ''}`}>
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

                                    const isCorrect = currentQuestion.type === 'multiple-select'
                                        ? currentQuestion.correctAnswers?.includes(idx)
                                        : currentQuestion.correctAnswer === idx;

                                    let bgClass = 'bg-gray-50 text-gray-900 border-gray-100 hover:bg-gray-100';
                                    if (isSelected && !isTimeUp) bgClass = 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-[1.02]';
                                    if (isTimeUp) {
                                        if (isCorrect) bgClass = 'bg-green-500 text-white border-green-500 shadow-md';
                                        else if (isSelected) bgClass = 'bg-red-500 text-white border-red-500 opacity-60';
                                        else bgClass = 'bg-gray-50 text-gray-300 border-gray-100 opacity-40';
                                    }

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
                                            className={`w-full p-5 rounded-2xl font-medium text-left transition-all border flex items-center justify-between ${bgClass} ${hasAnswered && !isTimeUp ? 'cursor-not-allowed opacity-60' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>{option}</span>
                                                {isTimeUp && isCorrect && <span className="text-xl">✅</span>}
                                                {isTimeUp && isSelected && !isCorrect && <span className="text-xl">❌</span>}
                                            </div>
                                            {currentQuestion.type === 'multiple-select' && !isTimeUp && (
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

                {/* Overlays */}
                {showResults && resultData && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 backdrop-blur-xl bg-slate-900/10">
                        <div className={`rounded-[3rem] p-12 shadow-2xl border max-w-2xl w-full flex flex-col items-center justify-center min-h-[600px] overflow-hidden relative transition-all duration-500 ${['multiple-choice', 'multiple-select', 'ranking'].includes(currentQuestion.type) ? (resultData.isCorrect ? 'bg-green-50/95 border-green-200' : 'bg-red-50/95 border-red-200') : 'bg-white/95 border-gray-200'}`}>

                            {/* Prominent Status Banner - Only for Objective Questions */}
                            {['multiple-choice', 'multiple-select', 'ranking'].includes(currentQuestion.type) ? (
                                <div className={`absolute top-0 left-0 right-0 py-4 px-12 flex items-center justify-center gap-4 animate-in slide-in-from-top duration-700 ${resultData.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    <span className="text-2xl">{resultData.isCorrect ? '✨' : '💫'}</span>
                                    <span className="text-xl font-black uppercase tracking-widest">
                                        {resultData.isCorrect ? 'Great Job!' : 'Nice Try!'}
                                    </span>
                                    <span className="text-2xl">{resultData.isCorrect ? '✨' : '💫'}</span>
                                </div>
                            ) : (
                                <div className="absolute top-0 left-0 right-0 py-4 px-12 flex items-center justify-center gap-4 bg-indigo-500 text-white animate-in slide-in-from-top duration-700">
                                    <span className="text-2xl">📝</span>
                                    <span className="text-xl font-black uppercase tracking-widest">Response Recorded!</span>
                                    <span className="text-2xl">📝</span>
                                </div>
                            )}

                            {/* Question and Answer section - Matches host's layout */}
                            <div className={`text-center transition-all duration-1000 ease-in-out ${showBoard ? 'mb-12 scale-75 -translate-y-12' : 'mb-0 scale-100 mt-12'}`}>
                                <div className="mb-6 flex flex-col items-center">
                                    {['multiple-choice', 'multiple-select', 'ranking'].includes(currentQuestion.type) ? (
                                        <>
                                            <div className="text-7xl mb-4 animate-bounce">
                                                {resultData.isCorrect ? '🤩' : '🥺'}
                                            </div>
                                            <h2 className={`text-sm font-bold uppercase tracking-[0.2em] mb-4 ${resultData.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                {resultData.isCorrect ? 'Correct Answer' : 'Incorrect'}
                                            </h2>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-7xl mb-4 animate-bounce">✨</div>
                                            <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">Question Results</h2>
                                        </>
                                    )}
                                </div>

                                <h1 className="text-3xl font-semibold text-gray-900 leading-tight mb-4">
                                    {currentQuestion.question}
                                </h1>

                                {resultData.isCorrect && (
                                    <div className="mb-8 animate-in zoom-in duration-500 delay-300 fill-mode-both">
                                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-400 text-yellow-900 rounded-full font-black text-lg shadow-lg border-2 border-white">
                                            <span>+</span>
                                            <span>{resultData.leaderboard?.find(p => p.id === peer?.id)?.pointsEarned || 0}</span>
                                            <span className="text-sm uppercase tracking-tighter opacity-70">points</span>
                                        </div>
                                    </div>
                                )}

                                {(['multiple-choice', 'multiple-select'].includes(currentQuestion.type)) && (
                                    <div className={`inline-block px-10 py-5 rounded-[2.5rem] shadow-sm border-2 ${resultData.isCorrect ? 'bg-green-100 border-green-200' : 'bg-white border-gray-100'}`}>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Answer Key</span>
                                        <span className={`text-2xl font-black ${resultData.isCorrect ? 'text-green-700' : 'text-indigo-600'}`}>
                                            {currentQuestion.type === 'multiple-choice'
                                                ? currentQuestion.options?.[currentQuestion.correctAnswer!]
                                                : currentQuestion.correctAnswers?.map(idx => currentQuestion.options?.[idx]).join(', ')
                                            }
                                        </span>
                                    </div>
                                )}

                                {currentQuestion.type === 'ranking' && (
                                    <div className="inline-block px-10 py-5 rounded-[2.5rem] shadow-sm border-2 bg-indigo-50 border-indigo-100">
                                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-2">Correct Order</span>
                                        <div className="space-y-1">
                                            {currentQuestion.correctOrder?.map((idx, i) => (
                                                <div key={idx} className="text-lg font-bold text-indigo-700">
                                                    {i + 1}. {currentQuestion.options?.[idx]}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Standings section - Only for Objective Questions */}
                            {['multiple-choice', 'multiple-select', 'ranking'].includes(currentQuestion.type) && (
                                <div className={`w-full space-y-4 transition-all duration-1000 ease-out ${showBoard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 h-0 pointer-events-none'}`}>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-2 text-center">Current Standings</h3>
                                    <div className="relative overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '300px' }}>
                                        <div className="space-y-4 pb-4">
                                            {resultData.leaderboard?.map((participant, index) => (
                                                <div
                                                    key={participant.id}
                                                    className="transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                                >
                                                    <div className={`rounded-2xl p-4 flex items-center justify-between border shadow-sm mx-2 ${participant.name === name
                                                        ? 'bg-indigo-50/50 border-indigo-200'
                                                        : 'bg-gray-50 border-gray-100'}`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                                                index === 1 ? 'bg-slate-300 text-slate-700' :
                                                                    index === 2 ? 'bg-orange-300 text-orange-800' :
                                                                        'bg-gray-200 text-gray-500'
                                                                }`}>
                                                                {index + 1}
                                                            </span>
                                                            <span className="text-3xl">{participant.avatar}</span>
                                                            <span className="font-semibold text-gray-800">
                                                                {participant.name} {participant.name === name && '(You)'}
                                                            </span>
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
                            )}

                            {/* Footer status */}
                            <div className="mt-8 pt-6 border-t border-gray-100 w-full flex flex-col items-center gap-4">
                                <div className="flex gap-2">
                                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                                    {['multiple-choice', 'multiple-select', 'ranking'].includes(currentQuestion.type)
                                        ? (resultData.isCorrect ? 'Spot on! Waiting for the presenter...' : 'Almost there! Waiting for the presenter...')
                                        : 'Wonderful! Waiting for the presenter...'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submitting Feedback Overlay */}
                {hasAnswered && !isTimeUp && !showResults && (
                    <div className="fixed inset-0 z-40 bg-white/30 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
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
                )}
            </div>
        );
    }

    return null;
}
