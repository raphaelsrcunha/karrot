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
        participants: [],
        answers: []
    });
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
                        currentQuestionIndex: sessionState.currentQuestionIndex
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

    const handleParticipantMessage = (participantId: string, data: any) => {
        switch (data.type) {
            case 'JOIN':
                const newParticipant: Participant = {
                    id: participantId,
                    name: data.payload.name,
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

    const handleNextQuestion = () => {
        if (!quiz) return;

        const nextIndex = sessionState.currentQuestionIndex + 1;
        if (nextIndex >= quiz.questions.length) return;

        setSessionState(prev => ({ ...prev, currentQuestionIndex: nextIndex }));

        broadcastToAll({
            type: 'NEXT_QUESTION',
            payload: { questionIndex: nextIndex }
        });
    };

    const handlePreviousQuestion = () => {
        const prevIndex = sessionState.currentQuestionIndex - 1;
        if (prevIndex < 0) return;

        setSessionState(prev => ({ ...prev, currentQuestionIndex: prevIndex }));

        broadcastToAll({
            type: 'NEXT_QUESTION',
            payload: { questionIndex: prevIndex }
        });
    };

    const handleDownloadResults = () => {
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

    if (!quiz) return null;

    const currentQuestion = quiz.questions[sessionState.currentQuestionIndex];
    const currentAnswers = sessionState.answers.filter(a => a.questionId === currentQuestion.id);

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 text-white">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">{quiz.title}</h1>
                        <p className="text-white/80 text-sm">
                            Question {sessionState.currentQuestionIndex + 1} of {quiz.questions.length}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-white/80 mb-1">Room Code</div>
                        <div className="text-4xl font-bold tracking-wider bg-white/20 px-6 py-2 rounded-lg">
                            {roomCode}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                <div className="grid grid-cols-3 gap-6">
                    {/* Main Question Display */}
                    <div className="col-span-2 space-y-6">
                        {/* Question Card */}
                        <div className="bg-white text-gray-900 rounded-2xl shadow-2xl p-12">
                            <div className="mb-6">
                                <span className="inline-block px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                                    {currentQuestion.type.replace('-', ' ').toUpperCase()}
                                </span>
                                <h2 className="text-4xl font-bold">{currentQuestion.question}</h2>
                            </div>

                            {/* Options for multiple choice */}
                            {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    {currentQuestion.options.map((option, idx) => {
                                        const answerCount = currentAnswers.filter(a => a.answer === idx).length;
                                        const percentage = currentAnswers.length > 0
                                            ? (answerCount / currentAnswers.length) * 100
                                            : 0;

                                        return (
                                            <div
                                                key={idx}
                                                className="relative bg-gray-100 rounded-xl p-6 overflow-hidden"
                                            >
                                                <div
                                                    className="absolute inset-0 bg-purple-200 transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                                <div className="relative flex justify-between items-center">
                                                    <span className="font-semibold text-lg">{option}</span>
                                                    <span className="text-2xl font-bold text-purple-600">
                                                        {answerCount}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Word cloud display */}
                            {currentQuestion.type === 'word-cloud' && (
                                <div className="mt-8 bg-gray-50 rounded-xl p-8 min-h-[200px]">
                                    <div className="flex flex-wrap gap-3 justify-center items-center">
                                        {currentAnswers.map((answer, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium"
                                                style={{
                                                    fontSize: `${Math.random() * 1 + 1}rem`
                                                }}
                                            >
                                                {answer.answer}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Open ended responses */}
                            {currentQuestion.type === 'open-ended' && (
                                <div className="mt-8 space-y-3 max-h-[400px] overflow-y-auto">
                                    {currentAnswers.map((answer, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-lg p-4">
                                            <div className="text-sm text-gray-500 mb-1">{answer.participantName}</div>
                                            <div className="text-gray-900">{answer.answer}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex gap-4">
                            <button
                                onClick={handlePreviousQuestion}
                                disabled={sessionState.currentQuestionIndex === 0}
                                className="px-6 py-3 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg font-semibold transition-all"
                            >
                                ← Previous
                            </button>
                            <button
                                onClick={handleNextQuestion}
                                disabled={sessionState.currentQuestionIndex === quiz.questions.length - 1}
                                className="flex-1 px-6 py-3 bg-white hover:bg-white/90 text-purple-600 disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all"
                            >
                                Next Question →
                            </button>
                            <button
                                onClick={handleDownloadResults}
                                className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all"
                            >
                                📥 Download Results
                            </button>
                        </div>
                    </div>

                    {/* Sidebar - Participants */}
                    <div className="space-y-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4">
                                Participants ({sessionState.participants.length})
                            </h3>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {sessionState.participants.map((participant) => {
                                    const hasAnswered = currentAnswers.some(a => a.participantId === participant.id);
                                    return (
                                        <div
                                            key={participant.id}
                                            className="flex items-center justify-between bg-white/10 rounded-lg p-3"
                                        >
                                            <span className="font-medium">{participant.name}</span>
                                            {hasAnswered && <span className="text-green-400">✓</span>}
                                        </div>
                                    );
                                })}
                                {sessionState.participants.length === 0 && (
                                    <p className="text-white/60 text-center py-8">
                                        Waiting for participants to join...
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4">Stats</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-white/80">Responses</span>
                                    <span className="font-bold">{currentAnswers.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/80">Response Rate</span>
                                    <span className="font-bold">
                                        {sessionState.participants.length > 0
                                            ? Math.round((currentAnswers.length / sessionState.participants.length) * 100)
                                            : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
