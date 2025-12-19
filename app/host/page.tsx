'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Quiz } from '@/types/quiz';

export default function HostPage() {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                // Validate quiz structure
                if (!json.title || !json.questions || !Array.isArray(json.questions)) {
                    throw new Error('Invalid quiz format');
                }

                setQuiz(json);
                setError('');
            } catch (err) {
                setError('Invalid JSON file. Please check the format.');
                setQuiz(null);
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        const template: Quiz = {
            title: 'Sample Quiz',
            description: 'A sample quiz to get you started',
            questions: [
                {
                    id: '1',
                    type: 'multiple-choice',
                    question: 'What is the capital of France?',
                    options: ['London', 'Berlin', 'Paris', 'Madrid'],
                    correctAnswer: 2,
                    timeLimit: 30
                },
                {
                    id: '2',
                    type: 'word-cloud',
                    question: 'Describe Karrot in one word',
                    timeLimit: 20
                }
            ]
        };

        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'karrot-quiz-template.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleStartQuiz = () => {
        if (!quiz) return;

        // Store quiz in sessionStorage
        sessionStorage.setItem('currentQuiz', JSON.stringify(quiz));

        // Navigate to session page
        router.push('/host/session');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Quiz</h1>
                    <p className="text-gray-600">Upload a JSON file or download a template to get started</p>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <div className="space-y-6">
                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Upload Quiz JSON
                            </label>
                            <div className="flex gap-3">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-gray-700 font-medium"
                                >
                                    📁 Choose File
                                </button>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-all"
                                >
                                    ⬇️ Download Template
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Quiz Preview */}
                        {quiz && (
                            <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{quiz.title}</h3>
                                {quiz.description && (
                                    <p className="text-gray-600 mb-4">{quiz.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-700">
                                    <span className="font-medium">
                                        📝 {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                                    </span>
                                    <span>
                                        Types: {[...new Set(quiz.questions.map(q => q.type))].join(', ')}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Start Button */}
                        <button
                            onClick={handleStartQuiz}
                            disabled={!quiz}
                            className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-all ${quiz
                                    ? 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg'
                                    : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            Start Quiz Session
                        </button>
                    </div>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="font-semibold text-blue-900 mb-2">💡 How it works</h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li>• Upload a JSON file with your quiz questions</li>
                        <li>• Share the generated room code with participants</li>
                        <li>• Control the quiz flow and see responses in real-time</li>
                        <li>• Download results when finished</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
