import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useRewardStore } from '@/store/rewardStore';
import type { LoggedSet, TemplateExercise, WorkoutSession, WorkoutTemplate } from '@/types';

function makeId(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

interface TrainingState {
  templates: WorkoutTemplate[];
  sessionsByDate: Record<string, WorkoutSession[]>;

  addTemplate: (name: string, exercises: Omit<TemplateExercise, 'id'>[]) => void;
  updateTemplate: (id: string, name: string, exercises: Omit<TemplateExercise, 'id'>[]) => void;
  removeTemplate: (id: string) => void;

  /** Attaches a template to a date: creates a new session pre-filled with the template's exercises (empty sets, ready to log). */
  attachTemplateToDate: (date: string, templateId: string) => void;
  removeSession: (date: string, sessionId: string) => void;

  addSet: (date: string, sessionId: string, exerciseId: string) => void;
  updateSet: (date: string, sessionId: string, exerciseId: string, setIndex: number, changes: Partial<LoggedSet>) => void;
  removeSet: (date: string, sessionId: string, exerciseId: string, setIndex: number) => void;
}

function mapSessionsForDate(
  sessionsByDate: Record<string, WorkoutSession[]>,
  date: string,
  transform: (sessions: WorkoutSession[]) => WorkoutSession[],
): Record<string, WorkoutSession[]> {
  return { ...sessionsByDate, [date]: transform(sessionsByDate?.[date] ?? []) };
}

function mapSession(sessions: WorkoutSession[], sessionId: string, transform: (session: WorkoutSession) => WorkoutSession): WorkoutSession[] {
  return (sessions ?? []).map((session) => (session.id === sessionId ? transform(session) : session));
}

function mapExercise(session: WorkoutSession, exerciseId: string, transform: (exercise: import('@/types').LoggedExercise) => import('@/types').LoggedExercise): WorkoutSession {
  return { ...session, exercises: (session.exercises ?? []).map((exercise) => (exercise.id === exerciseId ? transform(exercise) : exercise)) };
}

/** A session counts as "completed" once every exercise has at least one logged (reps > 0) set - the same bar `countRecentTrainingDays` uses to count a day as trained. */
function isSessionCompleted(session: WorkoutSession | undefined): boolean {
  const exercises = session?.exercises ?? [];
  return exercises.length > 0 && exercises.every((exercise) => (exercise.sets ?? []).some((set) => set.reps > 0));
}

/** Sanitizes persisted data from AsyncStorage - guards against partial/corrupted writes (interrupted app close, older schema) crashing render with undefined arrays. */
function sanitizeTemplate(template: Partial<WorkoutTemplate> | null | undefined): WorkoutTemplate {
  return {
    id: template?.id ?? makeId(),
    name: template?.name ?? '',
    exercises: (template?.exercises ?? []).map((exercise) => ({
      id: exercise?.id ?? makeId(),
      name: exercise?.name ?? '',
      targetSets: exercise?.targetSets ?? 3,
      targetRepsMin: exercise?.targetRepsMin ?? 8,
      targetRepsMax: exercise?.targetRepsMax ?? 12,
    })),
  };
}

function sanitizeSession(session: Partial<WorkoutSession> | null | undefined): WorkoutSession {
  return {
    id: session?.id ?? makeId(),
    templateId: session?.templateId ?? '',
    templateName: session?.templateName ?? '',
    date: session?.date ?? '',
    exercises: (session?.exercises ?? []).map((exercise) => ({
      id: exercise?.id ?? makeId(),
      name: exercise?.name ?? '',
      targetRepsMin: exercise?.targetRepsMin ?? 8,
      targetRepsMax: exercise?.targetRepsMax ?? 12,
      sets: (exercise?.sets ?? []).map((set) => ({ weightKg: set?.weightKg ?? 0, reps: set?.reps ?? 0 })),
    })),
  };
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      templates: [],
      sessionsByDate: {},

      addTemplate: (name, exercises) => {
        const template: WorkoutTemplate = {
          id: makeId(),
          name: name.trim(),
          exercises: exercises.map((exercise) => ({ ...exercise, id: makeId() })),
        };
        set((state) => ({ templates: [...state.templates, template] }));
      },

      updateTemplate: (id, name, exercises) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, name: name.trim(), exercises: exercises.map((exercise) => ({ ...exercise, id: makeId() })) }
              : template,
          ),
        }));
      },

      removeTemplate: (id) => {
        set((state) => ({ templates: state.templates.filter((template) => template.id !== id) }));
      },

      attachTemplateToDate: (date, templateId) => {
        set((state) => {
          const template = state.templates.find((t) => t.id === templateId);
          if (!template) return state;
          const session: WorkoutSession = {
            id: makeId(),
            templateId: template.id,
            templateName: template.name,
            date,
            exercises: template.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              targetRepsMin: exercise.targetRepsMin,
              targetRepsMax: exercise.targetRepsMax,
              sets: Array.from({ length: exercise.targetSets }, () => ({ weightKg: 0, reps: 0 })),
            })),
          };
          return { sessionsByDate: mapSessionsForDate(state.sessionsByDate, date, (sessions) => [...sessions, session]) };
        });
      },

      removeSession: (date, sessionId) => {
        set((state) => ({
          sessionsByDate: mapSessionsForDate(state.sessionsByDate, date, (sessions) =>
            sessions.filter((session) => session.id !== sessionId),
          ),
        }));
      },

      addSet: (date, sessionId, exerciseId) => {
        set((state) => ({
          sessionsByDate: mapSessionsForDate(state.sessionsByDate, date, (sessions) =>
            mapSession(sessions, sessionId, (session) =>
              mapExercise(session, exerciseId, (exercise) => ({
                ...exercise,
                sets: [...exercise.sets, { weightKg: exercise.sets[exercise.sets.length - 1]?.weightKg ?? 0, reps: 0 }],
              })),
            ),
          ),
        }));
      },

      updateSet: (date, sessionId, exerciseId, setIndex, changes) => {
        set((state) => ({
          sessionsByDate: mapSessionsForDate(state.sessionsByDate, date, (sessions) =>
            mapSession(sessions, sessionId, (session) =>
              mapExercise(session, exerciseId, (exercise) => ({
                ...exercise,
                sets: exercise.sets.map((set, index) => (index === setIndex ? { ...set, ...changes } : set)),
              })),
            ),
          ),
        }));

        const session = get().sessionsByDate[date]?.find((candidate) => candidate.id === sessionId);
        const completed = isSessionCompleted(session);
        useRewardStore.getState().checkTrainingSessionCompleted(sessionId, completed);
        if (completed) useRewardStore.getState().recordDailyActivity(date);
      },

      removeSet: (date, sessionId, exerciseId, setIndex) => {
        set((state) => ({
          sessionsByDate: mapSessionsForDate(state.sessionsByDate, date, (sessions) =>
            mapSession(sessions, sessionId, (session) =>
              mapExercise(session, exerciseId, (exercise) => ({
                ...exercise,
                sets: exercise.sets.filter((_, index) => index !== setIndex),
              })),
            ),
          ),
        }));
      },
    }),
    {
      name: 'coach-imi-training-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persisted, current) => {
        try {
          const state = (persisted ?? {}) as Partial<TrainingState>;
          return {
            ...current,
            templates: (state.templates ?? []).map(sanitizeTemplate),
            sessionsByDate: Object.fromEntries(
              Object.entries(state.sessionsByDate ?? {}).map(([date, sessions]) => [date, (sessions ?? []).map(sanitizeSession)]),
            ),
          };
        } catch (error) {
          console.error('Corrupt training storage, resetting to defaults:', error);
          return { ...current, templates: [], sessionsByDate: {} };
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate training storage, resetting to defaults:', error);
          useTrainingStore.setState({ templates: [], sessionsByDate: {} });
        }
      },
    },
  ),
);

/** All past sessions containing `exerciseName`, most recent first - used to compare today's numbers against history. */
export function getSessionsForExercise(exerciseName: string, beforeDate?: string): { date: string; exercise: import('@/types').LoggedExercise }[] {
  const { sessionsByDate } = useTrainingStore.getState();
  const results: { date: string; exercise: import('@/types').LoggedExercise }[] = [];

  for (const [date, sessions] of Object.entries(sessionsByDate ?? {})) {
    if (beforeDate && date >= beforeDate) continue;
    for (const session of sessions ?? []) {
      const exercise = session.exercises?.find((e) => e.name === exerciseName);
      if (exercise && (exercise.sets ?? []).some((set) => set.reps > 0)) {
        results.push({ date, exercise });
      }
    }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

/** Distinct dates in the last `days` that have at least one session with a logged set - feeds the supplement engine's "high training frequency" rule. */
export function countRecentTrainingDays(days: number): number {
  const { sessionsByDate } = useTrainingStore.getState();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  return Object.entries(sessionsByDate ?? {}).filter(
    ([date, sessions]) =>
      date >= cutoffKey && (sessions ?? []).some((session) => (session.exercises ?? []).some((ex) => (ex.sets ?? []).some((set) => set.reps > 0))),
  ).length;
}
