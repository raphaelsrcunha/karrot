export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'word-cloud' | 'open-ended';
  question: string;
  options?: string[]; // For multiple-choice
  correctAnswer?: number; // Index of correct answer (optional)
  timeLimit?: number; // In seconds
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
  answer: string | number;
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
