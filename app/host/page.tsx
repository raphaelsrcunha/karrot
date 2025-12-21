'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Quiz, QuizQuestion } from '@/types/quiz';
import { GRAMMAR_SAMPLE } from './samples';

const DEFAULT_QUESTION: QuizQuestion = {
    id: 'temp-1',
    type: 'multiple-choice',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    timeLimit: 30
};

export default function HostPage() {
    const [quiz, setQuiz] = useState<Quiz>({
        title: '',
        description: '',
        questions: [{ ...DEFAULT_QUESTION, id: crypto.randomUUID() }]
    });
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleAddQuestion = () => {
        const newQuestion: QuizQuestion = {
            ...DEFAULT_QUESTION,
            id: crypto.randomUUID()
        };
        setQuiz(prev => ({
            ...prev,
            questions: [...prev.questions, newQuestion]
        }));
        setActiveQuestionIndex(quiz.questions.length);
    };

    const handleRemoveQuestion = (index: number) => {
        if (quiz.questions.length <= 1) return;
        setQuiz(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index)
        }));
        if (activeQuestionIndex >= index && activeQuestionIndex > 0) {
            setActiveQuestionIndex(activeQuestionIndex - 1);
        }
    };

    const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
        setQuiz(prev => ({
            ...prev,
            questions: prev.questions.map((q, i) => i === index ? { ...q, ...updates } : q)
        }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!json.title || !json.questions || !Array.isArray(json.questions)) {
                    throw new Error('Invalid quiz format');
                }
                setQuiz(json);
                setError('');
                setActiveQuestionIndex(0);
            } catch (err) {
                setError('Invalid JSON file. Please check the format.');
            }
        };
        reader.readAsText(file);
    };

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz.title.toLowerCase().replace(/\s+/g, '-') || 'quiz'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleStartQuiz = () => {
        if (!quiz.title.trim()) {
            setError('Please enter a quiz title');
            return;
        }
        if (quiz.questions.some(q => !q.question.trim())) {
            setError('All questions must have text');
            return;
        }
        sessionStorage.setItem('currentQuiz', JSON.stringify(quiz));
        router.push('/host/session');
    };

    const currentQuestion = quiz.questions[activeQuestionIndex];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 flex flex-col">
            {/* Header Sticky */}
            <div className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-4 sm:px-8 py-3 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2 group transition-all hover:opacity-80">
                        <span className="text-2xl sm:text-3xl">🥕</span>
                        <span className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">my karrot</span>
                    </Link>

                    <div className="hidden sm:block w-[1px] h-8 bg-gray-200" />

                    <div className="flex-1 flex flex-col min-w-0">
                        <input
                            type="text"
                            value={quiz.title}
                            onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Untitled Quiz"
                            className="bg-transparent text-xl sm:text-2xl font-semibold text-gray-900 border-none focus:ring-0 placeholder:text-gray-300 w-full p-0 leading-tight"
                        />
                        <input
                            type="text"
                            value={quiz.description}
                            onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Add a description..."
                            className="bg-transparent text-sm text-gray-500 border-none focus:ring-0 placeholder:text-gray-300 w-full p-0 mt-1"
                        />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => {
                                if (quiz.questions.length > 1 || quiz.questions[0].question !== '' || quiz.title !== '') {
                                    if (!confirm('This will replace your current quiz with the Grammar Sample. Continue?')) return;
                                }
                                setQuiz(GRAMMAR_SAMPLE);
                                setActiveQuestionIndex(0);
                            }}
                            className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2"
                            title="Load Grammar Sample"
                        >
                            <span className="text-base">✨</span>
                            <span className="hidden md:inline">Try Sample</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                            title="Import JSON"
                        >
                            Import
                        </button>
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                            title="Export JSON"
                        >
                            Export
                        </button>
                        <div className="w-[1px] h-6 bg-gray-200 mx-1" />
                        <button
                            onClick={handleStartQuiz}
                            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-95 whitespace-nowrap"
                        >
                            Start Presentation
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 flex flex-col lg:flex-row gap-6 sm:gap-8 min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)]">
                {/* Sidebar - Question List */}
                <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-400 tracking-widest uppercase px-2 lg:px-0">
                        <span>Questions ({quiz.questions.length})</span>
                    </div>
                    <div className="flex lg:flex-col overflow-x-auto lg:overflow-y-auto space-x-4 lg:space-x-0 lg:space-y-4 p-6 -m-6 lg:p-0 lg:m-0 custom-scrollbar snap-x no-scrollbar lg:no-scrollbar-off">
                        {quiz.questions.map((q, idx) => (
                            <div
                                key={q.id}
                                onClick={() => setActiveQuestionIndex(idx)}
                                className={`group relative p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] cursor-pointer transition-all border-[3px] flex-shrink-0 w-64 lg:w-full snap-start ${activeQuestionIndex === idx
                                    ? 'bg-white border-indigo-500 shadow-lg'
                                    : 'bg-white/50 border-transparent hover:border-gray-200'
                                    }`}
                            >
                                <div className="text-xs font-semibold text-indigo-400 mb-1">#{idx + 1}</div>
                                <div className="text-sm font-medium text-gray-700 line-clamp-2 min-h-[2.5rem]">
                                    {q.question || <span className="text-gray-300 italic">Empty question...</span>}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-bold uppercase tracking-tighter">
                                        {q.type.replace('-', ' ')}
                                    </span>
                                    {quiz.questions.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveQuestion(idx);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={handleAddQuestion}
                            className="min-h-[100px] lg:min-h-0 lg:w-full py-4 px-8 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all font-bold text-sm flex items-center justify-center gap-2 flex-shrink-0"
                        >
                            <span className="text-lg">+</span> Add Question
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    {currentQuestion && (
                        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full animate-in fade-in lg:slide-in-from-bottom-4 duration-500">
                            {/* Question Settings Bar */}
                            <div className="bg-gray-50/50 border-b border-gray-100 p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <span className="hidden sm:inline text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Type</span>
                                    <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto w-full no-scrollbar">
                                        {(['multiple-choice', 'multiple-select', 'word-cloud', 'scales', 'ranking', 'open-ended', 'q-and-a'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    const updates: Partial<QuizQuestion> = {
                                                        type,
                                                        options: (type === 'multiple-choice' || type === 'multiple-select' || type === 'ranking') && !currentQuestion.options ? ['', '', ''] : currentQuestion.options,
                                                        scaleLabels: type === 'scales' ? { min: 'Low', max: 'High' } : currentQuestion.scaleLabels,
                                                        scaleMin: type === 'scales' ? 1 : currentQuestion.scaleMin,
                                                        scaleMax: type === 'scales' ? 10 : currentQuestion.scaleMax,
                                                        correctAnswers: type === 'multiple-select' ? (currentQuestion.correctAnswers || [0]) : undefined
                                                    };

                                                    if (type === 'ranking') {
                                                        const optCount = (updates.options || []).length;
                                                        updates.correctOrder = Array.from({ length: optCount }, (_, i) => i);
                                                    }

                                                    updateQuestion(activeQuestionIndex, updates);
                                                }}
                                                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${currentQuestion.type === type
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                {type.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-auto md:ml-0">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Time (s)</span>
                                    <input
                                        type="number"
                                        value={currentQuestion.timeLimit}
                                        onChange={(e) => updateQuestion(activeQuestionIndex, { timeLimit: parseInt(e.target.value) || 0 })}
                                        className="w-16 sm:w-20 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 border-none rounded-xl text-center font-black text-indigo-600 focus:ring-2 focus:ring-indigo-400"
                                        min="5"
                                        max="300"
                                    />
                                </div>
                            </div>

                            {/* Content Editor */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar">
                                <div className="max-w-3xl mx-auto space-y-8 sm:y-12">
                                    {/* Question Text */}
                                    <div className="space-y-4">
                                        <textarea
                                            value={currentQuestion.question}
                                            onChange={(e) => updateQuestion(activeQuestionIndex, { question: e.target.value })}
                                            placeholder="Write your question here..."
                                            className="w-full text-2xl sm:text-4xl font-semibold text-gray-900 border-none focus:ring-0 placeholder:text-gray-200 resize-none min-h-[120px] bg-transparent"
                                        />
                                    </div>

                                    {/* Multiple Choice Options */}
                                    {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'multiple-select') && (
                                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Options</h3>
                                                <span className="text-xs text-indigo-400 font-medium italic">
                                                    {currentQuestion.type === 'multiple-select' ? 'Select all correct answers' : 'Select the correct answer'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                {(currentQuestion.options || []).map((option, idx) => {
                                                    const isCorrect = currentQuestion.type === 'multiple-select'
                                                        ? (currentQuestion.correctAnswers || []).includes(idx)
                                                        : currentQuestion.correctAnswer === idx;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${isCorrect
                                                                ? 'border-green-500 bg-green-50 shadow-md'
                                                                : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                                                                }`}
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    if (currentQuestion.type === 'multiple-select') {
                                                                        const current = [...(currentQuestion.correctAnswers || [])];
                                                                        const exists = current.indexOf(idx);
                                                                        if (exists > -1) {
                                                                            current.splice(exists, 1);
                                                                        } else {
                                                                            current.push(idx);
                                                                        }
                                                                        updateQuestion(activeQuestionIndex, { correctAnswers: current });
                                                                    } else {
                                                                        updateQuestion(activeQuestionIndex, { correctAnswer: idx });
                                                                    }
                                                                }}
                                                                className={`w-6 h-6 flex items-center justify-center transition-all border-2 ${currentQuestion.type === 'multiple-select' ? 'rounded-lg' : 'rounded-full'
                                                                    } ${isCorrect
                                                                        ? 'bg-green-500 border-green-500 text-white'
                                                                        : 'bg-white border-gray-300'
                                                                    }`}
                                                            >
                                                                {isCorrect && <span className="text-[10px]">✓</span>}
                                                            </button>
                                                            <input
                                                                type="text"
                                                                value={option}
                                                                onChange={(e) => {
                                                                    const newOptions = [...(currentQuestion.options || [])];
                                                                    newOptions[idx] = e.target.value;
                                                                    updateQuestion(activeQuestionIndex, { options: newOptions });
                                                                }}
                                                                placeholder={`Option ${idx + 1}`}
                                                                className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 font-bold placeholder:text-gray-300"
                                                            />
                                                            {currentQuestion.options && currentQuestion.options.length > 2 && (
                                                                <button
                                                                    onClick={() => {
                                                                        const newOptions = currentQuestion.options?.filter((_, i) => i !== idx);
                                                                        const updates: Partial<QuizQuestion> = { options: newOptions };

                                                                        if (currentQuestion.type === 'multiple-select') {
                                                                            updates.correctAnswers = (currentQuestion.correctAnswers || [])
                                                                                .filter(i => i !== idx)
                                                                                .map(i => i > idx ? i - 1 : i);
                                                                        } else {
                                                                            updates.correctAnswer = currentQuestion.correctAnswer === idx ? 0 :
                                                                                (currentQuestion.correctAnswer! > idx ? currentQuestion.correctAnswer! - 1 : currentQuestion.correctAnswer);
                                                                        }

                                                                        updateQuestion(activeQuestionIndex, updates);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <button
                                                    onClick={() => {
                                                        const newOptions = [...(currentQuestion.options || []), ''];
                                                        updateQuestion(activeQuestionIndex, { options: newOptions });
                                                    }}
                                                    className="h-full min-h-[60px] border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-all font-bold text-sm"
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Scales Config */}
                                    {currentQuestion.type === 'scales' && (
                                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                                                <div className="space-y-4">
                                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Labels</h3>
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-600 uppercase">Min Label</label>
                                                            <input
                                                                type="text"
                                                                value={currentQuestion.scaleLabels?.min || ''}
                                                                onChange={(e) => updateQuestion(activeQuestionIndex, {
                                                                    scaleLabels: { ...(currentQuestion.scaleLabels || { min: '', max: '' }), min: e.target.value }
                                                                })}
                                                                placeholder="e.g. Disagree"
                                                                className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-400 border-none text-sm font-bold text-gray-900"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-600 uppercase">Max Label</label>
                                                            <input
                                                                type="text"
                                                                value={currentQuestion.scaleLabels?.max || ''}
                                                                onChange={(e) => updateQuestion(activeQuestionIndex, {
                                                                    scaleLabels: { ...(currentQuestion.scaleLabels || { min: '', max: '' }), max: e.target.value }
                                                                })}
                                                                placeholder="e.g. Agree"
                                                                className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-400 border-none text-sm font-bold text-gray-900"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Range</h3>
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-600 uppercase">Min Value</label>
                                                            <input
                                                                type="number"
                                                                value={currentQuestion.scaleMin ?? 1}
                                                                onChange={(e) => updateQuestion(activeQuestionIndex, { scaleMin: parseInt(e.target.value) })}
                                                                className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-400 border-none font-bold text-indigo-600"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-600 uppercase">Max Value</label>
                                                            <input
                                                                type="number"
                                                                value={currentQuestion.scaleMax ?? 10}
                                                                onChange={(e) => updateQuestion(activeQuestionIndex, { scaleMax: parseInt(e.target.value) })}
                                                                className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-indigo-400 border-none font-bold text-indigo-600"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Ranking Config */}
                                    {currentQuestion.type === 'ranking' && (
                                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Items to Rank</h3>
                                                <span className="text-xs text-indigo-400 font-medium italic">Participants will order these</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                {(currentQuestion.options || []).map((option, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50/50 border-2 border-transparent hover:border-gray-100 group transition-all">
                                                        <div className="flex flex-col gap-1 pr-1 border-r border-gray-200">
                                                            <button
                                                                onClick={() => {
                                                                    if (idx === 0) return;
                                                                    const newOptions = [...(currentQuestion.options || [])];
                                                                    const item = newOptions.splice(idx, 1)[0];
                                                                    newOptions.splice(idx - 1, 0, item);
                                                                    updateQuestion(activeQuestionIndex, {
                                                                        options: newOptions,
                                                                        correctOrder: newOptions.map((_, i) => i)
                                                                    });
                                                                }}
                                                                disabled={idx === 0}
                                                                className={`text-[10px] p-0.5 hover:bg-white rounded transition-colors ${idx === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-500'}`}
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (idx === (currentQuestion.options?.length || 0) - 1) return;
                                                                    const newOptions = [...(currentQuestion.options || [])];
                                                                    const item = newOptions.splice(idx, 1)[0];
                                                                    newOptions.splice(idx + 1, 0, item);
                                                                    updateQuestion(activeQuestionIndex, {
                                                                        options: newOptions,
                                                                        correctOrder: newOptions.map((_, i) => i)
                                                                    });
                                                                }}
                                                                disabled={idx === (currentQuestion.options?.length || 0) - 1}
                                                                className={`text-[10px] p-0.5 hover:bg-white rounded transition-colors ${idx === (currentQuestion.options?.length || 0) - 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-500'}`}
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                        <span className="w-6 h-6 flex items-center justify-center bg-white rounded-lg text-xs font-bold text-gray-400 shadow-sm">{idx + 1}</span>
                                                        <input
                                                            type="text"
                                                            value={option}
                                                            onChange={(e) => {
                                                                const newOptions = [...(currentQuestion.options || [])];
                                                                newOptions[idx] = e.target.value;
                                                                updateQuestion(activeQuestionIndex, { options: newOptions });
                                                            }}
                                                            placeholder={`Item ${idx + 1}`}
                                                            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 font-bold"
                                                        />
                                                        {(currentQuestion.options || []).length > 2 && (
                                                            <button
                                                                onClick={() => {
                                                                    const newOptions = currentQuestion.options?.filter((_, i) => i !== idx);
                                                                    updateQuestion(activeQuestionIndex, {
                                                                        options: newOptions,
                                                                        correctOrder: newOptions?.map((_, i) => i)
                                                                    });
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all font-bold"
                                                            >✕</button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => {
                                                        const newOptions = [...(currentQuestion.options || []), ''];
                                                        updateQuestion(activeQuestionIndex, {
                                                            options: newOptions,
                                                            correctOrder: newOptions.map((_, i) => i)
                                                        });
                                                    }}
                                                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-all font-bold text-sm"
                                                >
                                                    + Add Item
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-8 duration-300 z-[100]">
                    <span className="font-medium">{error}</span>
                    <button onClick={() => setError('')} className="bg-white/20 hover:bg-white/30 p-1 rounded-lg">✕</button>
                </div>
            )}

        </div>
    );
}
