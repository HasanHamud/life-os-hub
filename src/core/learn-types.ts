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

export const DEFAULT_ROTATION: Omit<RotationEntry, "id">[] = [
  { dayOfWeek: 0, subject: "Review",    topic: "Rest & light review", icon: "🧘", enabled: true },
  { dayOfWeek: 1, subject: "Math",      topic: "Functions",           icon: "📐", enabled: true },
  { dayOfWeek: 2, subject: "CP",        topic: "Arrays & Two Pointers", icon: "💻", enabled: true },
  { dayOfWeek: 3, subject: "Math",      topic: "Functions",           icon: "📐", enabled: true },
  { dayOfWeek: 4, subject: "CP",        topic: "Prefix Sums",         icon: "💻", enabled: true },
  { dayOfWeek: 5, subject: "Math",      topic: "Graphs & Transformations", icon: "📐", enabled: true },
  { dayOfWeek: 6, subject: "Physics",   topic: "Kinematics",          icon: "⚡", enabled: true },
];
