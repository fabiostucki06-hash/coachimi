import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FoodItem, MealEntry, MealType } from '@/types';
import { getLocalDateKey } from '@/utils/calendarDates';

function todayKey(): string {
  return getLocalDateKey();
}

function makeId(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export { makeId as makeEntryId };

const EMPTY_ENTRIES: MealEntry[] = [];

interface DiaryState {
  entriesByDate: Record<string, MealEntry[]>;
  lastUpdatedAt: string | null;
  addEntry: (date: string, foodItem: FoodItem, mealType: MealType, servings: number) => void;
  removeEntry: (date: string, entryId: string) => void;
  getEntriesForDate: (date: string) => MealEntry[];
}

export const useDiaryStore = create<DiaryState>()(
  persist(
    (set, get) => ({
      entriesByDate: {},
      lastUpdatedAt: null,

      addEntry: (date, foodItem, mealType, servings) => {
        const entry: MealEntry = {
          id: makeId(),
          foodItem,
          mealType,
          servings,
          loggedAt: new Date().toISOString(),
        };
        set((state) => ({
          entriesByDate: {
            ...state.entriesByDate,
            [date]: [...(state.entriesByDate[date] ?? []), entry],
          },
          lastUpdatedAt: entry.loggedAt,
        }));
      },

      removeEntry: (date, entryId) => {
        set((state) => ({
          entriesByDate: {
            ...state.entriesByDate,
            [date]: (state.entriesByDate[date] ?? []).filter((entry) => entry.id !== entryId),
          },
          lastUpdatedAt: new Date().toISOString(),
        }));
      },

      getEntriesForDate: (date) => get().entriesByDate[date] ?? EMPTY_ENTRIES,
    }),
    {
      name: 'coach-imi-diary-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as { entriesByDate?: Record<string, MealEntry[]>; lastUpdatedAt?: string | null } | undefined;
        return {
          entriesByDate: state?.entriesByDate ?? {},
          lastUpdatedAt: state?.lastUpdatedAt ?? null,
        };
      },
    },
  ),
);

/** Most-recently-logged distinct foods across all dates, newest first - used to prioritize search results before hitting the network. */
export function getRecentFoods(limit = 20): FoodItem[] {
  const entries = Object.values(useDiaryStore.getState().entriesByDate).flat();
  entries.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

  const seenNames = new Set<string>();
  const recent: FoodItem[] = [];
  for (const entry of entries) {
    const key = entry.foodItem.name.trim().toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    recent.push({ ...entry.foodItem, source: 'recent' });
    if (recent.length >= limit) break;
  }
  return recent;
}

export { todayKey };
