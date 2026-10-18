export interface Concept {
  id: string;
  subject: string;
  topic: string;
  title: string;
  phase: number;
  clarityRating: 1 | 2 | 3 | 4 | 5;
  canExplainWithoutNotes: boolean;
  notes: string;
  resourceLinks: string[];
  tags: string[];
  problemIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LearningInsight {
  id: string;
  subject: string;
  topic: string;
  keyIdea: string;
  insights: string[];
  mistakes: string;
  conceptId?: string;
  problemId?: string;
  tags: string[];
  date: string;
  nextReviewAt?: number;
  reviewCount: number;
  createdAt: number;
}

export interface Problem {
  id: string;
  title: string;
  subject: string;
  source: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  patternClass: string;
  timeToSolve?: number;
  notes: string;
  tags: string[];
  completed: boolean;
  completedAt?: number;
  createdAt: number;
}

export interface LearningSession {
  id: string;
  subject: string;
  topic: string;
  date: string;
  duration: number;
  completedSteps: ("recall" | "learn" | "apply" | "log")[];
  conceptId?: string;
  insightId?: string;
  problemId?: string;
  createdAt: number;
}

export interface RotationEntry {
  id: string;
  dayOfWeek: number;
  subject: string;
  topic: string;
  icon: string;
  enabled: boolean;
}

