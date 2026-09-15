import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  BadgeId,
  BorderId,
  BorderItem,
  IconPackId,
  IconPackItem,
  PerkId,
  PerkItem,
  Rank,
  RankId,
  RewardTransaction,
  ShopItem,
  ThemeId,
  ThemeItem,
} from '@/types';
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

/**
 * Exclusive OLED app themes - swaps background/surface/primary via CSS vars, see
 * utils/themePalettes.ts. "classic" is the free default everyone starts with and the
 * only one left purchasable - the Coin Shop no longer sells 'pure_black'/'deep_indigo'/
 * 'cyberpunk_neon', though themePalettes.ts still renders them correctly for anyone
 * who already unlocked one before this catalog was cut.
 */
export const THEMES: ThemeItem[] = [{ id: 'classic', name: 'Indigo Classic', description: 'Der originale Coach imi Look.', cost: 0 }];

/** Alternate icon sets for the meal cards on the dashboard - "default" is the free starting pack. */
export const ICON_PACKS: IconPackItem[] = [
  { id: 'default', name: 'Standard', description: 'Die klassischen Mahlzeiten-Icons.', cost: 0 },
  { id: 'minimal_line', name: 'Minimal Line', description: 'Reduzierte Linien-Icons für deine Mahlzeiten.', cost: 25 },
  { id: 'retro_bites', name: 'Retro Bites', description: 'Verspielte Retro-Icons für deine Mahlzeiten.', cost: 25 },
];

/** Avatar Frames: the ring shown around your profile picture on Dashboard, Profile, and in a friend's activity feed - "none" is the free default. */
export const BORDERS: BorderItem[] = [
  { id: 'none', name: 'Kein Rahmen', description: 'Standard-Avatar ohne Rahmen.', cost: 0 },
  { id: 'indigo_glow', name: 'Indigo Glow', description: 'Leuchtender Indigo-Rahmen in der Freundes-Ansicht.', cost: 30 },
  { id: 'gold_frame', name: 'Gold-Rahmen', description: 'Edler Gold-Rahmen, sichtbar für alle Freunde.', cost: 45 },
  { id: 'minimal_white_ring', name: 'Minimal White Ring', description: 'Schlichter weißer Ring für den High-Contrast-OLED-Look.', cost: 30 },
  { id: 'oled_gold_glow', name: 'OLED Gold Glow', description: 'Warmer Gold-Schimmer, gebaut für echtes OLED-Schwarz.', cost: 50 },
  { id: 'cyber_neon_border', name: 'Cyber Neon Border', description: 'Knalliger Cyan-Neon-Rahmen im Night-Mode-Look.', cost: 75 },
  { id: 'swiss_red_accent', name: 'Swiss Red Accent', description: 'Kräftiger Schweizer-Rot-Akzent als Statement-Rahmen.', cost: 100 },
];

/** One-time real-world unlocks - placeholder for Swiss/EU macro content, not equippable. Catalog emptied when the Perks section was removed from the Coin Shop; buyPerk/unlockedPerks stay so any already-unlocked perk (from before the cut) still reads back fine. */
export const PERKS: PerkItem[] = [];

export interface Celebration {
  id: number;
  amount: number;
  reason: string;
}

export interface PurchaseCelebration {
  id: number;
  itemName: string;
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
  purchaseCelebration: PurchaseCelebration | null;
  streakSavers: number;
  activeRank: RankId;
  unlockedRanks: RankId[];
  activeTheme: ThemeId;
  unlockedThemes: ThemeId[];
  activeIconPack: IconPackId;
  unlockedIconPacks: IconPackId[];
  activeBorder: BorderId;
  unlockedBorders: BorderId[];
  unlockedPerks: PerkId[];

  addGoldBars: (amount: number, reason: string) => void;
  dismissCelebration: () => void;
  dismissPurchaseCelebration: () => void;
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
  /** Schaltet ein Theme frei (falls nötig) und setzt es aktiv. Returns whether it succeeded. */
  buyTheme: (themeId: ThemeId) => boolean;
  /** Schaltet ein Mahlzeiten-Icon-Pack frei (falls nötig) und setzt es aktiv. Returns whether it succeeded. */
  buyIconPack: (packId: IconPackId) => boolean;
  /** Schaltet einen Avatar-Rahmen frei (falls nötig) und setzt ihn aktiv. Returns whether it succeeded. */
  buyBorder: (borderId: BorderId) => boolean;
  /** Einmaliger Kauf eines Perks (nicht ausrüstbar). Returns whether it succeeded. */
  buyPerk: (perkId: PerkId) => boolean;
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
      purchaseCelebration: null,
      streakSavers: 0,
      activeRank: 'neuling',
      unlockedRanks: ['neuling'],
      activeTheme: 'classic',
      unlockedThemes: ['classic'],
      activeIconPack: 'default',
      unlockedIconPacks: ['default'],
      activeBorder: 'none',
      unlockedBorders: ['none'],
      unlockedPerks: [],

      addGoldBars: (amount, reason) => {
        if (amount === 0) return;
        set((state) => ({
          goldBars: Math.max(0, state.goldBars + amount),
          transactionHistory: pushTransaction(state.transactionHistory, amount, reason),
          celebration: amount > 0 ? { id: ++nextCelebrationId, amount, reason } : state.celebration,
        }));
      },

      dismissCelebration: () => set({ celebration: null }),

      dismissPurchaseCelebration: () => set({ purchaseCelebration: null }),

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
          purchaseCelebration: { id: ++nextCelebrationId, itemName: item.name },
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
          purchaseCelebration: { id: ++nextCelebrationId, itemName: 'Streak-Schutzschild' },
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
          purchaseCelebration: rank.cost > 0 ? { id: ++nextCelebrationId, itemName: rank.name } : state.purchaseCelebration,
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

      buyTheme: (themeId) => {
        const theme = THEMES.find((candidate) => candidate.id === themeId);
        if (!theme) return false;

        const { unlockedThemes, goldBars } = get();
        if (unlockedThemes.includes(themeId)) {
          set({ activeTheme: themeId });
          return true;
        }

        if (goldBars < theme.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - theme.cost,
          unlockedThemes: [...state.unlockedThemes, themeId],
          activeTheme: themeId,
          transactionHistory: pushTransaction(state.transactionHistory, -theme.cost, `Theme freigeschaltet: ${theme.name}`),
          purchaseCelebration: { id: ++nextCelebrationId, itemName: theme.name },
        }));
        return true;
      },

      buyIconPack: (packId) => {
        const pack = ICON_PACKS.find((candidate) => candidate.id === packId);
        if (!pack) return false;

        const { unlockedIconPacks, goldBars } = get();
        if (unlockedIconPacks.includes(packId)) {
          set({ activeIconPack: packId });
          return true;
        }

        if (goldBars < pack.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - pack.cost,
          unlockedIconPacks: [...state.unlockedIconPacks, packId],
          activeIconPack: packId,
          transactionHistory: pushTransaction(state.transactionHistory, -pack.cost, `Icon-Pack freigeschaltet: ${pack.name}`),
          purchaseCelebration: { id: ++nextCelebrationId, itemName: pack.name },
        }));
        return true;
      },

      buyBorder: (borderId) => {
        const border = BORDERS.find((candidate) => candidate.id === borderId);
        if (!border) return false;

        const { unlockedBorders, goldBars } = get();
        if (unlockedBorders.includes(borderId)) {
          set({ activeBorder: borderId });
          return true;
        }

        if (goldBars < border.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - border.cost,
          unlockedBorders: [...state.unlockedBorders, borderId],
          activeBorder: borderId,
          transactionHistory: pushTransaction(state.transactionHistory, -border.cost, `Rahmen freigeschaltet: ${border.name}`),
          purchaseCelebration: { id: ++nextCelebrationId, itemName: border.name },
        }));
        return true;
      },

      buyPerk: (perkId) => {
        const perk = PERKS.find((candidate) => candidate.id === perkId);
        const { unlockedPerks, goldBars } = get();
        if (!perk || unlockedPerks.includes(perkId) || goldBars < perk.cost) return false;

        set((state) => ({
          goldBars: state.goldBars - perk.cost,
          unlockedPerks: [...state.unlockedPerks, perkId],
          transactionHistory: pushTransaction(state.transactionHistory, -perk.cost, `Freigeschaltet: ${perk.name}`),
          purchaseCelebration: { id: ++nextCelebrationId, itemName: perk.name },
        }));
        return true;
      },
    }),
    {
      name: 'coach-imi-reward-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // The celebration pop-up is transient UI state - never worth restoring on app relaunch.
      partialize: (state) => ({ ...state, celebration: null, purchaseCelebration: null }),
    },
  ),
);
