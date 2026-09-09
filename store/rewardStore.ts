import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BadgeId, Rank, RankId, RewardTransaction, ShopItem } from '@/types';
import { addDays, getLocalDateKey } from '@/utils/calendarDates';

function makeId(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** Cosmetic badges the user can unlock by spending Goldbarren - the actual reward, since swapping real app icons/themes needs native config outside this store's reach. */
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'protein_profi', name: 'Protein-Profi', description: 'Für alle, die ihr Proteinziel lieben.', cost: 15 },
  { id: 'streak_meister', name: 'Streak-Meister', description: 'Verliehen für Beständigkeit statt Perfektion.', cost: 20 },
  { id: 'gold_standard_tracker', name: 'Gold-Standard Tracker', description: 'Dein Ehrenabzeichen fürs lückenlose Tracking.', cost: 30 },
  { id: 'eisen_disziplin', name: 'Eisen-Disziplin', description: 'Das Badge für eiserne Trainingsdisziplin.', cost: 50 },
];

/** Profile ranks/titles - equippable, permanent once unlocked. "Neuling" is the free default everyone starts with. */
export const RANKS: Rank[] = [
  { id: 'neuling', name: 'Neuling', cost: 0 },
  { id: 'gold_standard_athlet', name: 'Gold-Standard-Athlet', cost: 50 },
  { id: 'eisen_disziplin_rang', name: 'Eisen-Disziplin', cost: 100 },
  { id: 'disziplin_legende', name: 'Disziplin-Legende', cost: 250 },
];

export const STREAK_SAVER_COST = 20;
export const MAX_STREAK_SAVERS = 3;

export interface Celebration {
  id: number;
  amount: number;
  reason: string;
}

interface RewardState {
  goldBars: number;
  streak: number;
  lastActiveDate: string | null;
  lastDailyClaimDate: string | null;
  lastGoalRewardDate: string | null;
  lastStreakRewardStreak: number;
  rewardedSessionIds: string[];
  unlockedBadges: BadgeId[];
  transactionHistory: RewardTransaction[];
  celebration: Celebration | null;
  streakSavers: number;
  activeRank: RankId;
  unlockedRanks: RankId[];

  addGoldBars: (amount: number, reason: string) => void;
  dismissCelebration: () => void;
  /** Call whenever the user logs a meal or a completed training session - advances the daily streak at most once per calendar day. */
  recordDailyActivity: (dateKey?: string) => void;
  /** +5 Goldbarren, once per day, but only once today's activity (meal or workout) has actually been recorded. Returns whether it was claimed. */
  claimDailyReward: () => boolean;
  checkCalorieProteinGoal: (input: {
    consumedCalories: number;
    calorieGoal: number;
    consumedProtein: number;
    proteinGoal: number;
    dateKey?: string;
  }) => void;
  checkTrainingSessionCompleted: (sessionId: string, isCompleted: boolean) => void;
  unlockBadge: (badgeId: BadgeId) => boolean;
  /** 20 Goldbarren für 1 Schutzschild, gedeckelt bei MAX_STREAK_SAVERS. Returns whether the purchase went through. */
  buyStreakSaver: () => boolean;
  /** Schaltet einen Rang frei (falls nötig) und setzt ihn aktiv. Returns whether it succeeded. */
  buyRank: (rankId: RankId) => boolean;
  /** Verbraucht bei einer verpassten Aktivitätslücke ein Schutzschild statt den Streak zu reißen. Returns whether a shield was consumed. */
  checkAndApplyStreakProtection: (dateKey?: string) => boolean;
}

let nextCelebrationId = 0;

function pushTransaction(history: RewardTransaction[], amount: number, reason: string): RewardTransaction[] {
  const now = new Date();
  const entry: RewardTransaction = { id: makeId(), amount, reason, date: getLocalDateKey(now), timestamp: now.toISOString() };
  return [entry, ...history].slice(0, 200);
}

export const useRewardStore = create<RewardState>()(
  persist(
    (set, get) => ({
      goldBars: 0,
      streak: 0,
      lastActiveDate: null,
      lastDailyClaimDate: null,
      lastGoalRewardDate: null,
      lastStreakRewardStreak: 0,
      rewardedSessionIds: [],
      unlockedBadges: [],
      transactionHistory: [],
      celebration: null,
      streakSavers: 0,
      activeRank: 'neuling',
      unlockedRanks: ['neuling'],

      addGoldBars: (amount, reason) => {
        if (amount === 0) return;
        set((state) => ({
          goldBars: Math.max(0, state.goldBars + amount),
          transactionHistory: pushTransaction(state.transactionHistory, amount, reason),
          celebration: amount > 0 ? { id: ++nextCelebrationId, amount, reason } : state.celebration,
        }));
      },

      dismissCelebration: () => set({ celebration: null }),

      recordDailyActivity: (dateKey) => {
        const today = dateKey ?? getLocalDateKey();
        get().checkAndApplyStreakProtection(today);
        set((state) => {
          if (state.lastActiveDate === today) return state;
          const isConsecutive = state.lastActiveDate !== null && addDays(state.lastActiveDate, 1) === today;
          return { streak: isConsecutive ? state.streak + 1 : 1, lastActiveDate: today };
        });

        const { streak, lastStreakRewardStreak } = get();
        if (streak > 0 && streak % 7 === 0 && streak !== lastStreakRewardStreak) {
          set({ lastStreakRewardStreak: streak });
          get().addGoldBars(5, `${streak}-Tage-Streak erreicht`);
        }
      },

      claimDailyReward: () => {
        const today = getLocalDateKey();
        const { lastDailyClaimDate, lastActiveDate } = get();
        if (lastDailyClaimDate === today || lastActiveDate !== today) return false;
        set({ lastDailyClaimDate: today });
        get().addGoldBars(5, 'Tägliche Belohnung');
        return true;
      },

      checkCalorieProteinGoal: ({ consumedCalories, calorieGoal, consumedProtein, proteinGoal, dateKey }) => {
        const today = dateKey ?? getLocalDateKey();
        if (get().lastGoalRewardDate === today) return;

        // "Hit" the calorie goal means landing close to it, not just crossing it on the way to a big overshoot.
        const hitCalorieGoal = calorieGoal > 0 && consumedCalories >= calorieGoal * 0.95 && consumedCalories <= calorieGoal * 1.05;
        const hitProteinGoal = proteinGoal > 0 && consumedProtein >= proteinGoal;
        if (!hitCalorieGoal && !hitProteinGoal) return;

        set({ lastGoalRewardDate: today });
        get().addGoldBars(1, hitCalorieGoal ? 'Kalorienziel erreicht' : 'Proteinziel erreicht');
      },

      checkTrainingSessionCompleted: (sessionId, isCompleted) => {
        if (!isCompleted || get().rewardedSessionIds.includes(sessionId)) return;
        set((state) => ({ rewardedSessionIds: [...state.rewardedSessionIds, sessionId] }));
        get().addGoldBars(2, 'Trainingseinheit abgeschlossen');
      },

      unlockBadge: (badgeId) => {
        const item = SHOP_ITEMS.find((shopItem) => shopItem.id === badgeId);
        const { unlockedBadges, goldBars } = get();
        if (!item || unlockedBadges.includes(badgeId) || goldBars < item.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - item.cost,
          unlockedBadges: [...state.unlockedBadges, badgeId],
          transactionHistory: pushTransaction(state.transactionHistory, -item.cost, `Freigeschaltet: ${item.name}`),
        }));
        return true;
      },

      buyStreakSaver: () => {
        const { goldBars, streakSavers } = get();
        if (streakSavers >= MAX_STREAK_SAVERS || goldBars < STREAK_SAVER_COST) return false;

        set((state) => ({
          goldBars: state.goldBars - STREAK_SAVER_COST,
          streakSavers: state.streakSavers + 1,
          transactionHistory: pushTransaction(state.transactionHistory, -STREAK_SAVER_COST, 'Streak-Schutzschild gekauft'),
        }));
        return true;
      },

      buyRank: (rankId) => {
        const rank = RANKS.find((candidate) => candidate.id === rankId);
        if (!rank) return false;

        const { unlockedRanks, goldBars } = get();
        if (unlockedRanks.includes(rankId)) {
          set({ activeRank: rankId });
          return true;
        }

        if (goldBars < rank.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - rank.cost,
          unlockedRanks: [...state.unlockedRanks, rankId],
          activeRank: rankId,
          transactionHistory: rank.cost > 0 ? pushTransaction(state.transactionHistory, -rank.cost, `Rang freigeschaltet: ${rank.name}`) : state.transactionHistory,
        }));
        return true;
      },

      checkAndApplyStreakProtection: (dateKey) => {
        const today = dateKey ?? getLocalDateKey();
        const { lastActiveDate, streak, streakSavers } = get();
        if (!lastActiveDate || lastActiveDate === today || streak <= 0 || streakSavers <= 0) return false;

        const isConsecutive = addDays(lastActiveDate, 1) === today;
        if (isConsecutive) return false;

        set((state) => ({
          streakSavers: state.streakSavers - 1,
          lastActiveDate: addDays(today, -1),
        }));
        return true;
      },
    }),
    {
      name: 'coach-imi-reward-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // The celebration pop-up is transient UI state - never worth restoring on app relaunch.
      partialize: (state) => ({ ...state, celebration: null }),
    },
  ),
);
