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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-4xl font-semibold text-gray-900 mb-3">Create presentation</h1>
                    <p className="text-lg text-gray-500 font-light">Upload a JSON file or download a template to get started</p>
                </div>

                {/* Upload Section */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-10 mb-6">
                    <div className="space-y-6">
                        {/* File Upload */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 tracking-wide mb-4">
                                UPLOAD QUIZ JSON
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
                                    className="flex-1 px-6 py-4 border-2 border-dashed border-gray-300 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-gray-600 font-medium"
                                >
                                    📁 Choose file
                                </button>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl font-medium text-gray-700 transition-all border border-gray-200"
                                >
                                    ⬇️ Template
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Quiz Preview */}
                        {quiz && (
                            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <h3 className="font-semibold text-lg text-gray-900 mb-2">{quiz.title}</h3>
                                {quiz.description && (
                                    <p className="text-gray-600 mb-4 text-sm">{quiz.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-700">
                                    <span className="font-medium">
                                        📝 {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-gray-500">
                                        {[...new Set(quiz.questions.map(q => q.type))].join(', ')}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Start Button */}
                        <button
                            onClick={handleStartQuiz}
                            disabled={!quiz}
                            className={`w-full py-5 rounded-2xl font-medium text-lg transition-all ${quiz
                                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm hover:shadow-md'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Start presentation
                        </button>
                    </div>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="font-semibold text-blue-900 mb-3 text-sm tracking-wide">💡 HOW IT WORKS</h4>
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
