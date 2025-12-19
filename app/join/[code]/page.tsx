'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Peer, { DataConnection } from 'peerjs';
import { Quiz, QuizQuestion } from '@/types/quiz';

export default function JoinPage() {
    const params = useParams();
    const router = useRouter();
    const roomCode = params.code as string;

    const [step, setStep] = useState<'name' | 'waiting' | 'quiz'>('name');
    const [name, setName] = useState('');
    const [peer, setPeer] = useState<Peer | null>(null);
    const [connection, setConnection] = useState<DataConnection | null>(null);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = () => {
        if (!name.trim()) return;

        // Create peer with random ID
        const newPeer = new Peer();

        newPeer.on('open', (id) => {
            console.log('Participant peer ID:', id);

            // Connect to host
            const conn = newPeer.connect(roomCode.toUpperCase());

            conn.on('open', () => {
                console.log('Connected to host');

                // Send join message
                conn.send({
                    type: 'JOIN',
                    payload: { name: name.trim() }
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
                setStep('quiz');
                setHasAnswered(false);
                setSelectedAnswer(null);
                break;

            case 'NEXT_QUESTION':
                setCurrentQuestionIndex(data.payload.questionIndex);
                setHasAnswered(false);
                setSelectedAnswer(null);
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
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-purple-600 mb-2">🥕</h1>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Quiz</h2>
                        <p className="text-gray-600">Room: <span className="font-bold">{roomCode}</span></p>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Your Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                                placeholder="Enter your name"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                maxLength={30}
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleJoin}
                            disabled={!name.trim()}
                            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${name.trim()
                                    ? 'bg-purple-600 hover:bg-purple-700'
                                    : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            Join Quiz
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Waiting Step
    if (step === 'waiting') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <div className="mb-8">
                        <div className="inline-block animate-bounce text-6xl mb-4">🥕</div>
                        <h2 className="text-3xl font-bold mb-2">Welcome, {name}!</h2>
                        <p className="text-xl text-white/80">Waiting for the quiz to start...</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                </div>
            </div>
        );
    }

    // Quiz Step
    if (step === 'quiz' && quiz) {
        const currentQuestion = quiz.questions[currentQuestionIndex];

        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full">
                    {/* Progress */}
                    <div className="text-center text-white mb-6">
                        <p className="text-sm opacity-80">
                            Question {currentQuestionIndex + 1} of {quiz.questions.length}
                        </p>
                        <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                            <div
                                className="bg-white h-2 rounded-full transition-all duration-500"
                                style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8">{currentQuestion.question}</h2>

                        {/* Multiple Choice */}
                        {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                            <div className="space-y-3">
                                {currentQuestion.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => !hasAnswered && setSelectedAnswer(idx)}
                                        disabled={hasAnswered}
                                        className={`w-full p-4 rounded-lg font-semibold text-left transition-all ${selectedAnswer === idx
                                                ? 'bg-purple-600 text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                            } ${hasAnswered ? 'cursor-not-allowed opacity-60' : 'hover:scale-102'}`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Word Cloud / Open Ended */}
                        {(currentQuestion.type === 'word-cloud' || currentQuestion.type === 'open-ended') && (
                            <div>
                                <textarea
                                    value={selectedAnswer as string || ''}
                                    onChange={(e) => setSelectedAnswer(e.target.value)}
                                    disabled={hasAnswered}
                                    placeholder="Type your answer..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    rows={currentQuestion.type === 'word-cloud' ? 2 : 4}
                                    maxLength={currentQuestion.type === 'word-cloud' ? 50 : 500}
                                />
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    {!hasAnswered ? (
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={selectedAnswer === null || selectedAnswer === ''}
                            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${selectedAnswer !== null && selectedAnswer !== ''
                                    ? 'bg-white text-purple-600 hover:shadow-xl hover:scale-105'
                                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                                }`}
                        >
                            Submit Answer
                        </button>
                    ) : (
                        <div className="text-center bg-green-500 text-white py-4 rounded-lg font-bold text-lg">
                            ✓ Answer Submitted!
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
