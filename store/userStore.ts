import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { calculateDietMacros } from '@/services/dietEngine';
import type { Macros, NutrientKey, User, WeightEntry } from '@/types';
import {
  calculateBMR,
  calculateDailyTargets,
  calculateMacros,
  calculateTDEE,
  caloriesFromMacros,
  DEFAULT_VISIBLE_NUTRIENTS,
  MACRO_RATIO_PRESET_VALUES,
  MICRONUTRIENT_FOCUS_KEYS,
  type ActivityLevel,
  type DietType,
  type Gender,
  type Goal,
  type MacroRatio,
  type MacroRatioPreset,
  type MicronutrientFocus,
} from '@/utils/nutritionCalculator';
import { getLocalDateKey } from '@/utils/calendarDates';

function makeId(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

const defaultUser: User = {
  id: 'u1',
  name: 'Max Mustermann',
  email: 'max.mustermann@example.com',
  dailyCalorieGoal: 2200,
  dailyMacroGoal: { carbs: 220, protein: 165, fat: 73 },
  weightKg: 78,
  heightCm: 180,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  macroRatioPreset: 'balanced',
  micronutrientFocus: 'none',
  dietType: 'balanced',
  visibleNutrients: DEFAULT_VISIBLE_NUTRIENTS,
};

export interface ProfileInput {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  macroRatioPreset?: MacroRatioPreset;
  customMacroRatio?: MacroRatio;
  dietType?: DietType;
}

export interface GoalsInput {
  dailyCalorieGoal: number;
  dailyMacroGoal: Macros;
}

interface UserState {
  user: User;
  weightHistory: WeightEntry[];
  hasOnboarded: boolean;
  updateAccount: (input: { name: string; email: string }) => void;
  setAvatarUrl: (avatarUrl: string) => void;
  updateProfile: (input: ProfileInput) => void;
  updateGoals: (input: GoalsInput) => void;
  addWeightEntry: (weightKg: number, date?: string) => void;
  updateWeightEntry: (id: string, changes: { date?: string; weightKg?: number }) => void;
  removeWeightEntry: (id: string) => void;
  toggleNutrientVisibility: (key: NutrientKey) => void;
  setMicronutrientFocus: (focus: MicronutrientFocus) => void;
  setDietType: (dietType: DietType) => void;
  finishOnboarding: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      weightHistory: [{ id: makeId(), date: getLocalDateKey(), weightKg: defaultUser.weightKg ?? 78 }],
      hasOnboarded: false,

      updateAccount: (input) => {
        set((state) => ({
          user: { ...state.user, name: input.name.trim(), email: input.email.trim() },
        }));
      },

      setAvatarUrl: (avatarUrl) => {
        set((state) => ({ user: { ...state.user, avatarUrl } }));
      },

      updateProfile: (input) => {
        const bmr = calculateBMR({
          age: input.age,
          gender: input.gender,
          weightKg: input.weightKg,
          heightCm: input.heightCm,
        });
        const tdee = calculateTDEE(bmr, input.activityLevel);
        const targetCalories = calculateDailyTargets(tdee, input.goal);
        const macroRatioPreset = input.macroRatioPreset ?? get().user.macroRatioPreset ?? 'balanced';
        const dietType = input.dietType ?? get().user.dietType ?? 'balanced';
        // The diet type is the primary driver of macro targets - a preset of 'custom' is
        // the one explicit escape hatch a user has to override it with their own split.
        // Every non-custom diet is weight-pinned/evidence-based (see calculateDietMacros),
        // not a plain %-of-calories ratio.
        const dailyMacroGoal =
          macroRatioPreset === 'custom'
            ? calculateMacros(targetCalories, input.customMacroRatio ?? MACRO_RATIO_PRESET_VALUES.balanced)
            : calculateDietMacros(dietType, targetCalories, input.weightKg, input.activityLevel);
        // Re-derived from the rounded macro grams (not `targetCalories` directly) so the
        // displayed calorie goal always exactly matches carbs*4 + protein*4 + fat*9 - see
        // caloriesFromMacros.
        const dailyCalorieGoal = caloriesFromMacros(dailyMacroGoal);

        set((state) => ({
          user: {
            ...state.user,
            age: input.age,
            gender: input.gender,
            heightCm: input.heightCm,
            weightKg: input.weightKg,
            goalWeightKg: input.goalWeightKg ?? state.user.goalWeightKg,
            activityLevel: input.activityLevel,
            goal: input.goal,
            macroRatioPreset,
            dietType,
            dailyCalorieGoal,
            dailyMacroGoal,
          },
        }));

        const today = getLocalDateKey();
        const history = get().weightHistory;
        const hasToday = history.some((entry) => entry.date === today);
        if (!hasToday) {
          get().addWeightEntry(input.weightKg, today);
        }
      },

      updateGoals: (input) => {
        set((state) => ({
          user: {
            ...state.user,
            dailyCalorieGoal: input.dailyCalorieGoal,
            dailyMacroGoal: { ...input.dailyMacroGoal },
          },
        }));
      },

      toggleNutrientVisibility: (key) => {
        set((state) => ({
          user: {
            ...state.user,
            visibleNutrients: {
              ...state.user.visibleNutrients,
              [key]: !state.user.visibleNutrients[key],
            },
          },
        }));
      },

      setMicronutrientFocus: (focus) => {
        set((state) => {
          const revealedKeys = focus === 'none' ? [] : MICRONUTRIENT_FOCUS_KEYS[focus];
          const revealedVisibility = Object.fromEntries(revealedKeys.map((key) => [key, true]));
          return {
            user: {
              ...state.user,
              micronutrientFocus: focus,
              visibleNutrients: { ...state.user.visibleNutrients, ...revealedVisibility },
            },
          };
        });
      },

      // Changing diet type post-onboarding recalibrates macro targets immediately (no
      // "save" step needed) - unless the user is on a 'custom' macro split, which is an
      // explicit manual override this must not silently clobber.
      setDietType: (dietType) => {
        set((state) => {
          const { user } = state;
          if (user.macroRatioPreset === 'custom') {
            return { user: { ...user, dietType } };
          }
          if (
            user.age === undefined ||
            user.gender === undefined ||
            user.heightCm === undefined ||
            user.weightKg === undefined ||
            user.activityLevel === undefined ||
            user.goal === undefined
          ) {
            return { user: { ...user, dietType } };
          }

          const bmr = calculateBMR({ age: user.age, gender: user.gender, weightKg: user.weightKg, heightCm: user.heightCm });
          const tdee = calculateTDEE(bmr, user.activityLevel);
          const targetCalories = calculateDailyTargets(tdee, user.goal);
          const dailyMacroGoal = calculateDietMacros(dietType, targetCalories, user.weightKg, user.activityLevel);
          const dailyCalorieGoal = caloriesFromMacros(dailyMacroGoal);

          return { user: { ...user, dietType, dailyMacroGoal, dailyCalorieGoal } };
        });
      },

      finishOnboarding: () => {
        set({ hasOnboarded: true });
      },

      addWeightEntry: (weightKg, date) => {
        const entryDate = date ?? getLocalDateKey();
        set((state) => {
          const withoutSameDay = state.weightHistory.filter((entry) => entry.date !== entryDate);
          const nextHistory = [...withoutSameDay, { id: makeId(), date: entryDate, weightKg }].sort(
            (a, b) => a.date.localeCompare(b.date),
          );
          // Only the chronologically latest entry represents the user's
          // "current" weight — logging a past or future date must not
          // clobber it, now that entries aren't always for today.
          const isLatest = nextHistory[nextHistory.length - 1]?.date === entryDate;
          return {
            weightHistory: nextHistory,
            user: isLatest ? { ...state.user, weightKg } : state.user,
          };
        });
      },

      updateWeightEntry: (id, changes) => {
        set((state) => {
          const existing = state.weightHistory.find((entry) => entry.id === id);
          if (!existing) return state;
          const nextDate = changes.date ?? existing.date;
          const nextWeightKg = changes.weightKg ?? existing.weightKg;
          // Upsert-by-date: if the edited date now collides with another
          // entry, that other entry is superseded rather than duplicated.
          const withoutConflicts = state.weightHistory.filter((entry) => entry.id !== id && entry.date !== nextDate);
          const nextHistory = [...withoutConflicts, { id, date: nextDate, weightKg: nextWeightKg }].sort(
            (a, b) => a.date.localeCompare(b.date),
          );
          const isLatest = nextHistory[nextHistory.length - 1]?.id === id;
          return {
            weightHistory: nextHistory,
            user: isLatest ? { ...state.user, weightKg: nextWeightKg } : state.user,
          };
        });
      },

      removeWeightEntry: (id) => {
        set((state) => {
          const nextHistory = state.weightHistory.filter((entry) => entry.id !== id);
          const latest = nextHistory[nextHistory.length - 1];
          return {
            weightHistory: nextHistory,
            user: latest ? { ...state.user, weightKg: latest.weightKg } : state.user,
          };
        });
      },
    }),
    {
      name: 'coach-imi-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: (persistedState, version) => {
        const state = persistedState as UserState;
        return {
          ...state,
          user: {
            ...defaultUser,
            ...state?.user,
            // Merge (not replace): a persisted visibleNutrients from before this
            // nutrient list grew only has the old keys, so newly added nutrients
            // need their default (hidden) rather than being left undefined.
            visibleNutrients: { ...DEFAULT_VISIBLE_NUTRIENTS, ...state?.user?.visibleNutrients },
            // Pre-v5 users have neither field persisted — same "balanced"/"none" defaults as new signups.
            macroRatioPreset: state?.user?.macroRatioPreset ?? 'balanced',
            micronutrientFocus: state?.user?.micronutrientFocus ?? 'none',
            // Pre-v6 users have no diet type persisted - same "balanced" default as new signups.
            dietType: state?.user?.dietType ?? 'balanced',
          },
          // Users persisted before onboarding existed already have a profile, so don't force them through it.
          hasOnboarded: version >= 3 ? (state?.hasOnboarded ?? false) : true,
        };
      },
    },
  ),
);
