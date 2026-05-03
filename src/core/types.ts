export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type Priority = "low" | "med" | "high" | "urgent";
export type BlockType = "deep" | "shallow" | "personal";
export type SessionType = "focus" | "break";
export type RecurrenceFreq = "none" | "daily" | "weekly" | "custom";

export interface Recurrence {
  freq: RecurrenceFreq;
  intervalDays?: number; // for custom
  weekdays?: number[]; // 0-6 (0=Sun) for weekly
  until?: number; // timestamp
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  effort?: number; // minutes estimate
  deadline?: number; // timestamp
  projectId?: string;
  goalId?: string;
  tagIds: string[];
  parentTaskId?: string;
  dependsOnIds?: string[];
  recurrence?: Recurrence;
  recurrenceParentId?: string; // if generated from a recurring template
  archived?: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TimeBlock {
  id: string;
  taskId?: string;
  title: string;
  startTime: number;
  endTime: number;
  type: BlockType;
  isCompleted: boolean;
  notes?: string;
  recurrence?: Recurrence;
  recurrenceParentId?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  archived?: boolean;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  durationDays: 30 | 60 | 90 | number;
  startDate: number;
  endDate: number;
  linkedTaskIds: string[];
  createdAt: number;
}

export interface Session {
  id: string;
  taskId?: string;
  projectId?: string;
  startTime: number;
  endTime: number;
  duration: number; // seconds
  type: SessionType;
  notes?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  relatedTaskId?: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
}

export interface Snapshot {
  id: string;
  name: string;
  createdAt: number;
  data: string; // JSON
}

export type Currency = "USD" | "LBP";

export interface Settings {
  id: "global";
  pomodoroFocus: number; // minutes
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  pomodoroLongEvery: number;
  notificationsEnabled: boolean;
  workdayStart: number; // hour 0-23
  workdayEnd: number;
  // Multi-currency
  baseCurrency: Currency; // currency totals are reported in
  usdToLbpRate: number; // how many LBP for 1 USD (e.g. 90000)
}
