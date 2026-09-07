jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

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
