jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// rewardStore no longer owns the coin balance (see store/coinsStore.ts) - it
// only records transaction history/celebrations locally and delegates the
// actual earn/spend to coinsStore's RPC-backed actions. Mocked here so these
// tests exercise rewardStore's own logic without hitting Supabase, and so
// each test can control whether a "purchase" is affordable.
const mockCoinsState = {
  addCoins: jest.fn(async () => true),
  spendCoins: jest.fn(async () => true),
};
jest.mock('@/store/coinsStore', () => ({
  useCoinsStore: { getState: () => mockCoinsState },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCoinsStore } from '@/store/coinsStore';
import type { BorderId, IconPackId, RankId, ThemeId } from '@/types';

import { useRewardStore } from './rewardStore';

const RESET_STATE = {
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
  mockCoinsState.addCoins.mockClear();
  mockCoinsState.spendCoins.mockClear();
  mockCoinsState.spendCoins.mockResolvedValue(true);
});

describe('addGoldBars', () => {
  it('records a transaction and credits coinsStore', () => {
    useRewardStore.getState().addGoldBars(3, 'Testgrund');
    const state = useRewardStore.getState();
    expect(state.transactionHistory[0]).toMatchObject({ amount: 3, reason: 'Testgrund' });
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(3);
  });

  it('triggers a celebration pop-up only for positive amounts', () => {
    useRewardStore.getState().addGoldBars(5, 'Bonus');
    expect(useRewardStore.getState().celebration).toMatchObject({ amount: 5, reason: 'Bonus' });

    useRewardStore.getState().dismissCelebration();
    mockCoinsState.addCoins.mockClear();
    useRewardStore.getState().addGoldBars(-2, 'Ausgabe');
    expect(useRewardStore.getState().celebration).toBeNull();
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
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
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(5);

    // Day 8 shouldn't re-trigger the streak bonus.
    mockCoinsState.addCoins.mockClear();
    useRewardStore.getState().recordDailyActivity('2026-01-08');
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });
});

describe('claimDailyReward', () => {
  it('refuses the claim before any activity was recorded today', () => {
    const claimed = useRewardStore.getState().claimDailyReward();
    expect(claimed).toBe(false);
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });

  it('awards +5 Goldbarren once activity was recorded today, and refuses a second claim', () => {
    const today = new Date().toISOString().slice(0, 10);
    useRewardStore.getState().recordDailyActivity(today);

    expect(useRewardStore.getState().claimDailyReward()).toBe(true);
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(5);

    mockCoinsState.addCoins.mockClear();
    expect(useRewardStore.getState().claimDailyReward()).toBe(false);
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
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
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(1);
  });

  it('awards +1 Goldbarren when the protein goal is hit even if calories are off', () => {
    useRewardStore.getState().checkCalorieProteinGoal({
      consumedCalories: 1000,
      calorieGoal: 2000,
      consumedProtein: 160,
      proteinGoal: 150,
      dateKey: '2026-01-01',
    });
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(1);
  });

  it('does not award when neither goal is hit', () => {
    useRewardStore.getState().checkCalorieProteinGoal({
      consumedCalories: 900,
      calorieGoal: 2000,
      consumedProtein: 40,
      proteinGoal: 150,
      dateKey: '2026-01-01',
    });
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });

  it('only awards once per day even if checked again after eating more', () => {
    const params = { consumedCalories: 1980, calorieGoal: 2000, consumedProtein: 50, proteinGoal: 150, dateKey: '2026-01-01' };
    useRewardStore.getState().checkCalorieProteinGoal(params);
    mockCoinsState.addCoins.mockClear();
    useRewardStore.getState().checkCalorieProteinGoal({ ...params, consumedCalories: 2100 });
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });
});

describe('checkTrainingSessionCompleted', () => {
  it('awards +2 Goldbarren the first time a session completes', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    expect(useCoinsStore.getState().addCoins).toHaveBeenCalledWith(2);
  });

  it('does not award twice for the same session', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    mockCoinsState.addCoins.mockClear();
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', true);
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });

  it('does not award for an incomplete session', () => {
    useRewardStore.getState().checkTrainingSessionCompleted('session-1', false);
    expect(useCoinsStore.getState().addCoins).not.toHaveBeenCalled();
  });
});

describe('unlockBadge', () => {
  it('unlocks a badge and spends its cost via coinsStore when affordable', async () => {
    const unlocked = await useRewardStore.getState().unlockBadge('protein_profi');
    expect(unlocked).toBe(true);
    expect(useRewardStore.getState().unlockedBadges).toContain('protein_profi');
    expect(useCoinsStore.getState().spendCoins).toHaveBeenCalledWith(15);
  });

  it('refuses to unlock when coinsStore reports an insufficient balance', async () => {
    mockCoinsState.spendCoins.mockResolvedValueOnce(false);
    const unlocked = await useRewardStore.getState().unlockBadge('eisen_disziplin');
    expect(unlocked).toBe(false);
    expect(useRewardStore.getState().unlockedBadges).not.toContain('eisen_disziplin');
  });

  it('refuses to unlock the same badge twice', async () => {
    expect(await useRewardStore.getState().unlockBadge('protein_profi')).toBe(true);
    expect(await useRewardStore.getState().unlockBadge('protein_profi')).toBe(false);
  });
});

describe('buyStreakSaver', () => {
  it('buys a shield and spends 20 Goldbarren via coinsStore when affordable', async () => {
    expect(await useRewardStore.getState().buyStreakSaver()).toBe(true);
    expect(useRewardStore.getState().streakSavers).toBe(1);
    expect(useCoinsStore.getState().spendCoins).toHaveBeenCalledWith(20);
  });

  it('refuses when coinsStore reports an insufficient balance', async () => {
    mockCoinsState.spendCoins.mockResolvedValueOnce(false);
    expect(await useRewardStore.getState().buyStreakSaver()).toBe(false);
    expect(useRewardStore.getState().streakSavers).toBe(0);
  });

  it('refuses past the cap of 3 shields without spending again', async () => {
    await useRewardStore.getState().buyStreakSaver();
    await useRewardStore.getState().buyStreakSaver();
    await useRewardStore.getState().buyStreakSaver();
    expect(useRewardStore.getState().streakSavers).toBe(3);

    mockCoinsState.spendCoins.mockClear();
    expect(await useRewardStore.getState().buyStreakSaver()).toBe(false);
    expect(useRewardStore.getState().streakSavers).toBe(3);
    expect(useCoinsStore.getState().spendCoins).not.toHaveBeenCalled();
  });
});

describe('buyRank', () => {
  it('unlocks and equips a rank when affordable', async () => {
    expect(await useRewardStore.getState().buyRank('gold_standard_athlet')).toBe(true);
    expect(useRewardStore.getState().unlockedRanks).toContain('gold_standard_athlet');
    expect(useRewardStore.getState().activeRank).toBe('gold_standard_athlet');
    expect(useCoinsStore.getState().spendCoins).toHaveBeenCalledWith(50);
  });

  it('refuses when coinsStore reports an insufficient balance', async () => {
    mockCoinsState.spendCoins.mockResolvedValueOnce(false);
    expect(await useRewardStore.getState().buyRank('eisen_disziplin_rang')).toBe(false);
    expect(useRewardStore.getState().unlockedRanks).not.toContain('eisen_disziplin_rang');
  });

  it('re-equips an already unlocked rank for free, without spending again', async () => {
    await useRewardStore.getState().buyRank('gold_standard_athlet');
    await useRewardStore.getState().buyRank('neuling');
    expect(useRewardStore.getState().activeRank).toBe('neuling');

    mockCoinsState.spendCoins.mockClear();
    expect(await useRewardStore.getState().buyRank('gold_standard_athlet')).toBe(true);
    expect(useRewardStore.getState().activeRank).toBe('gold_standard_athlet');
    expect(useCoinsStore.getState().spendCoins).not.toHaveBeenCalled();
  });
});

describe('buyTheme', () => {
  it('re-equips the free classic theme', async () => {
    expect(await useRewardStore.getState().buyTheme('classic')).toBe(true);
    expect(useRewardStore.getState().activeTheme).toBe('classic');
  });

  it('refuses a theme no longer in the Coin Shop catalog', async () => {
    expect(await useRewardStore.getState().buyTheme('pure_black')).toBe(false);
    expect(useRewardStore.getState().unlockedThemes).not.toContain('pure_black');
  });
});

describe('buyIconPack', () => {
  it('unlocks and equips an icon pack when affordable', async () => {
    expect(await useRewardStore.getState().buyIconPack('minimal_line')).toBe(true);
    expect(useRewardStore.getState().unlockedIconPacks).toContain('minimal_line');
    expect(useRewardStore.getState().activeIconPack).toBe('minimal_line');
    expect(useCoinsStore.getState().spendCoins).toHaveBeenCalledWith(25);
  });

  it('refuses when coinsStore reports an insufficient balance', async () => {
    mockCoinsState.spendCoins.mockResolvedValueOnce(false);
    expect(await useRewardStore.getState().buyIconPack('retro_bites')).toBe(false);
    expect(useRewardStore.getState().unlockedIconPacks).not.toContain('retro_bites');
  });
});

describe('buyBorder', () => {
  it('unlocks and equips a border when affordable', async () => {
    expect(await useRewardStore.getState().buyBorder('indigo_glow')).toBe(true);
    expect(useRewardStore.getState().unlockedBorders).toContain('indigo_glow');
    expect(useRewardStore.getState().activeBorder).toBe('indigo_glow');
    expect(useCoinsStore.getState().spendCoins).toHaveBeenCalledWith(30);
  });

  it('refuses when coinsStore reports an insufficient balance', async () => {
    mockCoinsState.spendCoins.mockResolvedValueOnce(false);
    expect(await useRewardStore.getState().buyBorder('gold_frame')).toBe(false);
    expect(useRewardStore.getState().unlockedBorders).not.toContain('gold_frame');
  });
});

describe('buyPerk', () => {
  it('refuses any perk now that the Coin Shop perk catalog is empty', async () => {
    expect(await useRewardStore.getState().buyPerk('macro_recipes_pdf')).toBe(false);
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
