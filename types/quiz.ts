export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'multiple-select' | 'word-cloud' | 'open-ended' | 'scales' | 'ranking' | 'q-and-a';
  question: string;
  options?: string[]; // For multiple-choice and ranking
  correctAnswer?: number; // Index of correct answer (optional)
  correctAnswers?: number[]; // For multiple-select
  timeLimit?: number; // In seconds
  scaleLabels?: { min: string; max: string }; // For scales
  scaleMin?: number; // For scales
  scaleMax?: number; // For scales
}

export interface Quiz {
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

export interface ParticipantAnswer {
  participantId: string;
  participantName: string;
  questionId: string;
  answer: string | number | number[];
  timestamp: number;
}

export interface SessionState {
  quizId: string;
  currentQuestionIndex: number;
  isActive: boolean;
  hasStarted: boolean;
  participants: Participant[];
  answers: ParticipantAnswer[];
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}
