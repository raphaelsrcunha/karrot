import { Quiz } from '@/types/quiz';

export const GRAMMAR_SAMPLE: Quiz = {
    title: "English Grammar Masterclass",
    description: "A comprehensive test of your English grammar skills across all formats.",
    questions: [
        {
            id: 'q1',
            type: 'multiple-choice',
            question: "Which sentence uses the correct form of 'their/there/they're'?",
            options: ["There going to the park.", "Look over they're!", "Their house is very big.", "I hope there happy."],
            correctAnswer: 2,
            timeLimit: 20
        },
        {
            id: 'q2',
            type: 'multiple-select',
            question: "Select all the irregular verbs from the list below:",
            options: ["Walk", "Run", "Eat", "Talk", "Go", "Sleep"],
            correctAnswers: [1, 2, 4, 5],
            timeLimit: 30
        },
        {
            id: 'q3',
            type: 'word-cloud',
            question: "What are some common English adjectives you use daily?",
            timeLimit: 30
        },
        {
            id: 'q4',
            type: 'scales',
            question: "How comfortable do you feel using Conditionals (If-clauses)?",
            scaleLabels: { min: "Confused", max: "Expert" },
            scaleMin: 1,
            scaleMax: 10,
            timeLimit: 20
        },
        {
            id: 'q5',
            type: 'ranking',
            question: "Rank these tenses by their typical order of learning (earliest to latest):",
            options: ["Present Simple", "Past Continuous", "Present Perfect", "Future Perfect Continuous"],
            timeLimit: 40
        },
        {
            id: 'q6',
            type: 'open-ended',
            question: "Explain the difference between 'since' and 'for' in one short sentence.",
            timeLimit: 60
        },
        {
            id: 'q7',
            type: 'q-and-a',
            question: "Any burning questions about English idioms? Ask them here!",
            timeLimit: 120
        },
        {
            id: 'q8',
            type: 'multiple-choice',
            question: "What is the superlative form of the adjective 'far' when referring to distance?",
            options: ["Farest", "Farther", "Furthest", "Farthest"],
            correctAnswer: 3,
            timeLimit: 25
        },
        {
            id: 'q9',
            type: 'multiple-select',
            question: "Which of these are correct examples of the passive voice?",
            options: ["The cake was eaten.", "She ate the cake.", "The letter will be sent.", "They sent the letter.", "Lessons are being learned."],
            correctAnswers: [0, 2, 4],
            timeLimit: 35
        },
        {
            id: 'q10',
            type: 'word-cloud',
            question: "Write down some English phrasal verbs you know (e.g., 'get up')!",
            timeLimit: 45
        }
    ]
};
