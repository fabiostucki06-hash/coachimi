jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BorderId, IconPackId, RankId, ThemeId } from '@/types';

import { useRewardStore } from './rewardStore';

const RESET_STATE = {
  goldBars: 0,
  streak: 0,
  lastActiveDate: null,
  lastDailyClaimDate: null,
  lastGoalRewardDate: null,
  lastStreakRewardStreak: 0,
  rewardedSessionIds: [] as string[],
  unlockedBadges: [],
  transactionHistory: [],
  celebration: null,
  purchaseCelebration: null,
  streakSavers: 0,
  activeRank: 'neuling' as RankId,
  unlockedRanks: ['neuling'] as RankId[],
  activeTheme: 'classic' as ThemeId,
  unlockedThemes: ['classic'] as ThemeId[],
  activeIconPack: 'default' as IconPackId,
  unlockedIconPacks: ['default'] as IconPackId[],
  activeBorder: 'none' as BorderId,
  unlockedBorders: ['none'] as BorderId[],
  unlockedPerks: [],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useRewardStore.setState(RESET_STATE);
});

describe('addGoldBars', () => {
  it('adds to the balance and records a transaction', () => {
    useRewardStore.getState().addGoldBars(3, 'Testgrund');
    const state = useRewardStore.getState();
    expect(state.goldBars).toBe(3);
    expect(state.transactionHistory[0]).toMatchObject({ amount: 3, reason: 'Testgrund' });
  });

  it('triggers a celebration pop-up only for positive amounts', () => {
    useRewardStore.getState().addGoldBars(5, 'Bonus');
    expect(useRewardStore.getState().celebration).toMatchObject({ amount: 5, reason: 'Bonus' });

    useRewardStore.getState().dismissCelebration();
    useRewardStore.getState().addGoldBars(-2, 'Ausgabe');
    expect(useRewardStore.getState().celebration).toBeNull();
  });

  it('never lets the balance go negative', () => {
    useRewardStore.getState().addGoldBars(-10, 'Ausgabe');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });
});

describe('recordDailyActivity', () => {
  it('starts the streak at 1 on the first activity', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    expect(useRewardStore.getState().streak).toBe(1);
  });

  it('does not double-count activity recorded twice on the same day', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    expect(useRewardStore.getState().streak).toBe(1);
  });

  it('increments the streak on a consecutive day', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.getState().recordDailyActivity('2026-01-02');
    expect(useRewardStore.getState().streak).toBe(2);
  });

  it('resets the streak after a gap day', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.getState().recordDailyActivity('2026-01-03');
    expect(useRewardStore.getState().streak).toBe(1);
  });

  it('awards +5 Goldbarren exactly once when a 7-day streak is reached', () => {
    for (let day = 1; day <= 7; day += 1) {
      useRewardStore.getState().recordDailyActivity(`2026-01-0${day}`);
    }
    expect(useRewardStore.getState().streak).toBe(7);
    expect(useRewardStore.getState().goldBars).toBe(5);

    // Day 8 shouldn't re-trigger the streak bonus.
    useRewardStore.getState().recordDailyActivity('2026-01-08');
    expect(useRewardStore.getState().goldBars).toBe(5);
  });
});

describe('claimDailyReward', () => {
  it('refuses the claim before any activity was recorded today', () => {
    const claimed = useRewardStore.getState().claimDailyReward();
    expect(claimed).toBe(false);
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('awards +5 Goldbarren once activity was recorded today, and refuses a second claim', () => {
    const today = new Date().toISOString().slice(0, 10);
    useRewardStore.getState().recordDailyActivity(today);

    expect(useRewardStore.getState().claimDailyReward()).toBe(true);
    expect(useRewardStore.getState().goldBars).toBe(5);

    expect(useRewardStore.getState().claimDailyReward()).toBe(false);
    expect(useRewardStore.getState().goldBars).toBe(5);
  });
});

describe('checkCalorieProteinGoal', () => {
  it('awards +1 Goldbarren when the calorie goal is hit', () => {
    useRewardStore.getState().checkCalorieProteinGoal({
      consumedCalories: 1980,
      calorieGoal: 2000,
      consumedProtein: 50,
      proteinGoal: 150,
      dateKey: '2026-01-01',
    });
    expect(useRewardStore.getState().goldBars).toBe(1);
  });

  it('awards +1 Goldbarren when the protein goal is hit even if calories are off', () => {
    useRewardStore.getState().checkCalorieProteinGoal({
      consumedCalories: 1000,
      calorieGoal: 2000,
      consumedProtein: 160,
      proteinGoal: 150,
      dateKey: '2026-01-01',
    });
    expect(useRewardStore.getState().goldBars).toBe(1);
  });

  it('does not award when neither goal is hit', () => {
    useRewardStore.getState().checkCalorieProteinGoal({
      consumedCalories: 900,
      calorieGoal: 2000,
      consumedProtein: 40,
      proteinGoal: 150,
      dateKey: '2026-01-01',
    });
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('only awards once per day even if checked again after eating more', () => {
    const params = { consumedCalories: 1980, calorieGoal: 2000, consumedProtein: 50, proteinGoal: 150, dateKey: '2026-01-01' };
    useRewardStore.getState().checkCalorieProteinGoal(params);
    useRewardStore.getState().checkCalorieProteinGoal({ ...params, consumedCalories: 2100 });
    expect(useRewardStore.getState().goldBars).toBe(1);
  });
});

describe('checkTrainingSessionCompleted', () => {
  it('awards +2 Goldbarren the first time a session completes', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    expect(useRewardStore.getState().goldBars).toBe(2);
  });

  it('does not award twice for the same session', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    expect(useRewardStore.getState().goldBars).toBe(2);
  });

  it('does not award for an incomplete session', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', false);
    expect(useRewardStore.getState().goldBars).toBe(0);
  });
});

describe('unlockBadge', () => {
  it('unlocks a badge and deducts its cost when affordable', () => {
    useRewardStore.getState().addGoldBars(20, 'Testguthaben');
    const unlocked = useRewardStore.getState().unlockBadge('protein_profi');
    expect(unlocked).toBe(true);
    expect(useRewardStore.getState().unlockedBadges).toContain('protein_profi');
    expect(useRewardStore.getState().goldBars).toBe(5);
  });

  it('refuses to unlock when the balance is too low', () => {
    const unlocked = useRewardStore.getState().unlockBadge('eisen_disziplin');
    expect(unlocked).toBe(false);
    expect(useRewardStore.getState().unlockedBadges).not.toContain('eisen_disziplin');
  });

  it('refuses to unlock the same badge twice', () => {
    useRewardStore.getState().addGoldBars(100, 'Testguthaben');
    expect(useRewardStore.getState().unlockBadge('protein_profi')).toBe(true);
    expect(useRewardStore.getState().unlockBadge('protein_profi')).toBe(false);
  });
});

describe('buyStreakSaver', () => {
  it('buys a shield and deducts 20 Goldbarren when affordable', () => {
    useRewardStore.getState().addGoldBars(20, 'Testguthaben');
    expect(useRewardStore.getState().buyStreakSaver()).toBe(true);
    expect(useRewardStore.getState().streakSavers).toBe(1);
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyStreakSaver()).toBe(false);
    expect(useRewardStore.getState().streakSavers).toBe(0);
  });

  it('refuses past the cap of 3 shields', () => {
    useRewardStore.getState().addGoldBars(80, 'Testguthaben');
    useRewardStore.getState().buyStreakSaver();
    useRewardStore.getState().buyStreakSaver();
    useRewardStore.getState().buyStreakSaver();
    expect(useRewardStore.getState().streakSavers).toBe(3);
    expect(useRewardStore.getState().buyStreakSaver()).toBe(false);
    expect(useRewardStore.getState().streakSavers).toBe(3);
  });
});

describe('buyRank', () => {
  it('unlocks and equips a rank when affordable', () => {
    useRewardStore.getState().addGoldBars(50, 'Testguthaben');
    expect(useRewardStore.getState().buyRank('gold_standard_athlet')).toBe(true);
    expect(useRewardStore.getState().unlockedRanks).toContain('gold_standard_athlet');
    expect(useRewardStore.getState().activeRank).toBe('gold_standard_athlet');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyRank('eisen_disziplin_rang')).toBe(false);
    expect(useRewardStore.getState().unlockedRanks).not.toContain('eisen_disziplin_rang');
  });

  it('re-equips an already unlocked rank for free', () => {
    useRewardStore.getState().addGoldBars(50, 'Testguthaben');
    useRewardStore.getState().buyRank('gold_standard_athlet');
    useRewardStore.getState().buyRank('neuling');
    expect(useRewardStore.getState().activeRank).toBe('neuling');
    expect(useRewardStore.getState().buyRank('gold_standard_athlet')).toBe(true);
    expect(useRewardStore.getState().activeRank).toBe('gold_standard_athlet');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });
});

describe('buyTheme', () => {
  it('unlocks and equips a theme when affordable, and triggers a purchase celebration', () => {
    useRewardStore.getState().addGoldBars(40, 'Testguthaben');
    expect(useRewardStore.getState().buyTheme('pure_black')).toBe(true);
    expect(useRewardStore.getState().unlockedThemes).toContain('pure_black');
    expect(useRewardStore.getState().activeTheme).toBe('pure_black');
    expect(useRewardStore.getState().goldBars).toBe(0);
    expect(useRewardStore.getState().purchaseCelebration).toMatchObject({ itemName: 'Pure Pitch Black' });
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyTheme('cyberpunk_neon')).toBe(false);
    expect(useRewardStore.getState().unlockedThemes).not.toContain('cyberpunk_neon');
  });

  it('re-equips an already unlocked theme for free', () => {
    useRewardStore.getState().addGoldBars(40, 'Testguthaben');
    useRewardStore.getState().buyTheme('pure_black');
    useRewardStore.getState().buyTheme('classic');
    expect(useRewardStore.getState().activeTheme).toBe('classic');
    expect(useRewardStore.getState().buyTheme('pure_black')).toBe(true);
    expect(useRewardStore.getState().activeTheme).toBe('pure_black');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });
});

describe('buyIconPack', () => {
  it('unlocks and equips an icon pack when affordable', () => {
    useRewardStore.getState().addGoldBars(25, 'Testguthaben');
    expect(useRewardStore.getState().buyIconPack('minimal_line')).toBe(true);
    expect(useRewardStore.getState().unlockedIconPacks).toContain('minimal_line');
    expect(useRewardStore.getState().activeIconPack).toBe('minimal_line');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyIconPack('retro_bites')).toBe(false);
    expect(useRewardStore.getState().unlockedIconPacks).not.toContain('retro_bites');
  });
});

describe('buyBorder', () => {
  it('unlocks and equips a border when affordable', () => {
    useRewardStore.getState().addGoldBars(30, 'Testguthaben');
    expect(useRewardStore.getState().buyBorder('indigo_glow')).toBe(true);
    expect(useRewardStore.getState().unlockedBorders).toContain('indigo_glow');
    expect(useRewardStore.getState().activeBorder).toBe('indigo_glow');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyBorder('gold_frame')).toBe(false);
    expect(useRewardStore.getState().unlockedBorders).not.toContain('gold_frame');
  });
});

describe('buyPerk', () => {
  it('unlocks a perk and deducts its cost when affordable', () => {
    useRewardStore.getState().addGoldBars(35, 'Testguthaben');
    expect(useRewardStore.getState().buyPerk('macro_recipes_pdf')).toBe(true);
    expect(useRewardStore.getState().unlockedPerks).toContain('macro_recipes_pdf');
    expect(useRewardStore.getState().goldBars).toBe(0);
  });

  it('refuses to unlock the same perk twice', () => {
    useRewardStore.getState().addGoldBars(70, 'Testguthaben');
    expect(useRewardStore.getState().buyPerk('macro_recipes_pdf')).toBe(true);
    expect(useRewardStore.getState().buyPerk('macro_recipes_pdf')).toBe(false);
  });

  it('refuses when the balance is too low', () => {
    expect(useRewardStore.getState().buyPerk('macro_recipes_pdf')).toBe(false);
    expect(useRewardStore.getState().unlockedPerks).not.toContain('macro_recipes_pdf');
  });
});

describe('checkAndApplyStreakProtection', () => {
  it('consumes a shield and preserves the streak across a missed day', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.setState({ streakSavers: 1 });

    useRewardStore.getState().recordDailyActivity('2026-01-03');

    expect(useRewardStore.getState().streak).toBe(2);
    expect(useRewardStore.getState().streakSavers).toBe(0);
  });

  it('does nothing without a shield, so the streak still resets', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.getState().recordDailyActivity('2026-01-03');
    expect(useRewardStore.getState().streak).toBe(1);
  });

  it('does not consume a shield for a consecutive day', () => {
    useRewardStore.getState().recordDailyActivity('2026-01-01');
    useRewardStore.setState({ streakSavers: 2 });
    useRewardStore.getState().recordDailyActivity('2026-01-02');
    expect(useRewardStore.getState().streakSavers).toBe(2);
    expect(useRewardStore.getState().streak).toBe(2);
  });
});
