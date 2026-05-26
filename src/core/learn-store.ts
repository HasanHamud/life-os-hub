import { create } from "zustand";
import { format } from "date-fns";
import { getAll, putOne, delOne, uid } from "./db";
import type { Concept, LearningInsight, Problem, LearningSession, RotationEntry } from "./learn-types";
import { DEFAULT_ROTATION } from "./learn-types";

interface LearnState {
  concepts: Concept[];
  insights: LearningInsight[];
  problems: Problem[];
  sessions: LearningSession[];
  rotation: RotationEntry[];

  load: () => Promise<void>;

  // Concepts
  getConcepts: () => Concept[];
  getConcept: (id: string) => Concept | undefined;
  upsertConcept: (patch: Partial<Concept> & { subject: string; title: string }) => Promise<Concept>;
  deleteConcept: (id: string) => Promise<void>;

  // Insights
  getInsights: () => LearningInsight[];
  getInsight: (id: string) => LearningInsight | undefined;
  upsertInsight: (patch: Partial<LearningInsight> & { subject: string; keyIdea: string }) => Promise<LearningInsight>;
  deleteInsight: (id: string) => Promise<void>;

  // Problems
  getProblems: () => Problem[];
  getProblem: (id: string) => Problem | undefined;
  upsertProblem: (patch: Partial<Problem> & { title: string }) => Promise<Problem>;
  deleteProblem: (id: string) => Promise<void>;

  // Sessions
  getSessions: () => LearningSession[];
  upsertSession: (patch: Partial<LearningSession> & { subject: string; topic: string }) => Promise<LearningSession>;
  deleteSession: (id: string) => Promise<void>;

  // Rotation
  getRotation: () => RotationEntry[];
  getDayEntry: (dayOfWeek: number) => RotationEntry | undefined;
  upsertRotationEntry: (entry: RotationEntry) => Promise<void>;
  deleteRotationEntry: (id: string) => Promise<void>;
  seedRotation: () => Promise<void>;

  // Helpers
  distinctSubjects: () => string[];
  recentInsights: (days: number) => LearningInsight[];
}

export const useLearnStore = create<LearnState>((set, get) => ({
  concepts: [],
  insights: [],
  problems: [],
  sessions: [],
  rotation: [],

  load: async () => {
    const [concepts, insights, problems, sessions, rotation] = await Promise.all([
      getAll<Concept>("concepts"),
      getAll<LearningInsight>("insights"),
      getAll<Problem>("problems"),
      getAll<LearningSession>("learningSessions"),
      getAll<RotationEntry>("rotationEntries"),
    ]);
    set({ concepts, insights, problems, sessions, rotation });
    if (rotation.length === 0) {
      await get().seedRotation();
    }
  },

  // ─── Concepts ───

  getConcepts: () => get().concepts,

  getConcept: (id) => get().concepts.find((c) => c.id === id),

  upsertConcept: async (patch) => {
    const now = Date.now();
    const existing = patch.id ? get().concepts.find((c) => c.id === patch.id) : undefined;
    const concept: Concept = {
      id: existing?.id ?? uid(),
      subject: patch.subject ?? existing?.subject ?? "",
      topic: patch.topic ?? existing?.topic ?? "",
      title: patch.title ?? existing?.title ?? "Untitled",
      phase: patch.phase ?? existing?.phase ?? 1,
      clarityRating: patch.clarityRating ?? existing?.clarityRating ?? 1,
      canExplainWithoutNotes: patch.canExplainWithoutNotes ?? existing?.canExplainWithoutNotes ?? false,
      notes: patch.notes ?? existing?.notes ?? "",
      resourceLinks: patch.resourceLinks ?? existing?.resourceLinks ?? [],
      tags: patch.tags ?? existing?.tags ?? [],
      problemIds: patch.problemIds ?? existing?.problemIds ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await putOne("concepts", concept);
    set((s) => ({
      concepts: existing
        ? s.concepts.map((x) => (x.id === concept.id ? concept : x))
        : [...s.concepts, concept],
    }));
    return concept;
  },

  deleteConcept: async (id) => {
    await delOne("concepts", id);
    set((s) => ({ concepts: s.concepts.filter((c) => c.id !== id) }));
  },

  // ─── Insights ───

  getInsights: () => get().insights,

  getInsight: (id) => get().insights.find((i) => i.id === id),

  upsertInsight: async (patch) => {
    const existing = patch.id ? get().insights.find((i) => i.id === patch.id) : undefined;
    const insight: LearningInsight = {
      id: existing?.id ?? uid(),
      subject: patch.subject ?? existing?.subject ?? "",
      topic: patch.topic ?? existing?.topic ?? "",
      keyIdea: patch.keyIdea ?? existing?.keyIdea ?? "",
      insights: patch.insights ?? existing?.insights ?? [],
      mistakes: patch.mistakes ?? existing?.mistakes ?? "",
      conceptId: patch.conceptId ?? existing?.conceptId,
      problemId: patch.problemId ?? existing?.problemId,
      tags: patch.tags ?? existing?.tags ?? [],
      date: patch.date ?? existing?.date ?? format(new Date(), "yyyy-MM-dd"),
      nextReviewAt: patch.nextReviewAt ?? existing?.nextReviewAt,
      reviewCount: patch.reviewCount ?? existing?.reviewCount ?? 0,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("insights", insight);
    set((s) => ({
      insights: existing
        ? s.insights.map((x) => (x.id === insight.id ? insight : x))
        : [...s.insights, insight],
    }));
    return insight;
  },

  deleteInsight: async (id) => {
    await delOne("insights", id);
    set((s) => ({ insights: s.insights.filter((i) => i.id !== id) }));
  },

  // ─── Problems ───

  getProblems: () => get().problems,

  getProblem: (id) => get().problems.find((p) => p.id === id),

  upsertProblem: async (patch) => {
    const now = Date.now();
    const existing = patch.id ? get().problems.find((p) => p.id === patch.id) : undefined;
    const problem: Problem = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Untitled",
      subject: patch.subject ?? existing?.subject ?? "",
      source: patch.source ?? existing?.source ?? "",
      difficulty: patch.difficulty ?? existing?.difficulty ?? 1,
      patternClass: patch.patternClass ?? existing?.patternClass ?? "",
      timeToSolve: patch.timeToSolve ?? existing?.timeToSolve,
      notes: patch.notes ?? existing?.notes ?? "",
      tags: patch.tags ?? existing?.tags ?? [],
      completed: patch.completed ?? existing?.completed ?? false,
      completedAt: patch.completed
        ? (existing?.completedAt ?? now)
        : patch.completed === false
        ? undefined
        : existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
    };
    await putOne("problems", problem);
    set((s) => ({
      problems: existing
        ? s.problems.map((x) => (x.id === problem.id ? problem : x))
        : [...s.problems, problem],
    }));
    return problem;
  },

  deleteProblem: async (id) => {
    await delOne("problems", id);
    set((s) => ({ problems: s.problems.filter((p) => p.id !== id) }));
  },

  // ─── Sessions ───

  getSessions: () => get().sessions,

  upsertSession: async (patch) => {
    const existing = patch.id ? get().sessions.find((s) => s.id === patch.id) : undefined;
    const session: LearningSession = {
      id: existing?.id ?? uid(),
      subject: patch.subject ?? existing?.subject ?? "",
      topic: patch.topic ?? existing?.topic ?? "",
      date: patch.date ?? existing?.date ?? format(new Date(), "yyyy-MM-dd"),
      duration: patch.duration ?? existing?.duration ?? 0,
      completedSteps: patch.completedSteps ?? existing?.completedSteps ?? [],
      conceptId: patch.conceptId ?? existing?.conceptId,
      insightId: patch.insightId ?? existing?.insightId,
      problemId: patch.problemId ?? existing?.problemId,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("learningSessions", session);
    set((s) => ({
      sessions: existing
        ? s.sessions.map((x) => (x.id === session.id ? session : x))
        : [...s.sessions, session],
    }));
    return session;
  },

  deleteSession: async (id) => {
    await delOne("learningSessions", id);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
  },

  // ─── Rotation ───

  getRotation: () => get().rotation,

  getDayEntry: (dayOfWeek) => get().rotation.find((r) => r.dayOfWeek === dayOfWeek),

  upsertRotationEntry: async (entry) => {
    await putOne("rotationEntries", entry);
    set((s) => ({
      rotation: s.rotation.some((r) => r.id === entry.id)
        ? s.rotation.map((r) => (r.id === entry.id ? entry : r))
        : [...s.rotation, entry],
    }));
  },

  deleteRotationEntry: async (id) => {
    await delOne("rotationEntries", id);
    set((s) => ({ rotation: s.rotation.filter((r) => r.id !== id) }));
  },

  seedRotation: async () => {
    const entries: RotationEntry[] = DEFAULT_ROTATION.map((d, i) => ({
      id: `day-${d.dayOfWeek}`,
      ...d,
    }));
    for (const entry of entries) {
      await putOne("rotationEntries", entry);
    }
    set({ rotation: entries });
  },

  // ─── Helpers ───

  distinctSubjects: () => {
    const subjects = new Set<string>();
    for (const c of get().concepts) subjects.add(c.subject);
    for (const i of get().insights) subjects.add(i.subject);
    for (const p of get().problems) subjects.add(p.subject);
    for (const s of get().sessions) subjects.add(s.subject);
    return Array.from(subjects).sort();
  },

  recentInsights: (days) => {
    const cutoff = Date.now() - days * 86400000;
    return get().insights.filter((i) => i.createdAt >= cutoff);
  },
}));
