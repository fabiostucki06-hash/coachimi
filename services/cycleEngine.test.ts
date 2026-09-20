import { getActiveCycle, getDayComplianceStatus, getEffectiveDailyTargets } from './cycleEngine';
import type { DietCycle, User } from '@/types';

function makeCycle(overrides: Partial<DietCycle> = {}): DietCycle {
  return {
    id: 'cycle-1',
    name: 'Keto Phase',
    type: 'strict',
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    targetDisabled: false,
    targetOverrides: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Test',
    email: 'test@example.com',
    dailyCalorieGoal: 2000,
    dailyMacroGoal: { carbs: 200, protein: 150, fat: 65 },
    visibleNutrients: {} as User['visibleNutrients'],
    ...overrides,
  };
}

describe('getActiveCycle', () => {
  it('returns null when no cycle covers the date', () => {
    expect(getActiveCycle([makeCycle()], '2026-02-01')).toBeNull();
  });

  it('returns the cycle covering the date (inclusive bounds)', () => {
    const cycle = makeCycle();
    expect(getActiveCycle([cycle], '2026-01-01')?.id).toBe('cycle-1');
    expect(getActiveCycle([cycle], '2026-01-14')?.id).toBe('cycle-1');
    expect(getActiveCycle([cycle], '2026-01-07')?.id).toBe('cycle-1');
  });

  it('picks the last-added cycle when ranges overlap', () => {
    const first = makeCycle({ id: 'first' });
    const second = makeCycle({ id: 'second', name: 'Cheat Days', type: 'cheat' });
    expect(getActiveCycle([first, second], '2026-01-05')?.id).toBe('second');
  });
});

describe('getEffectiveDailyTargets', () => {
  it('falls back to the user goal outside of any cycle', () => {
    const user = makeUser();
    const result = getEffectiveDailyTargets(user, [makeCycle()], '2026-02-01');
    expect(result.cycle).toBeNull();
    expect(result.targetsSuppressed).toBe(false);
    expect(result.calorieGoal).toBe(2000);
    expect(result.macroGoal).toEqual(user.dailyMacroGoal);
  });

  it('suppresses targets during a targetDisabled cycle (Cheat/Break Period)', () => {
    const user = makeUser();
    const cheatCycle = makeCycle({ type: 'cheat', targetDisabled: true });
    const result = getEffectiveDailyTargets(user, [cheatCycle], '2026-01-05');
    expect(result.targetsSuppressed).toBe(true);
    expect(result.cycle?.id).toBe('cycle-1');
    // Suppressed still reports the normal goal numbers (for reference), just flagged.
    expect(result.calorieGoal).toBe(2000);
  });

  it('merges targetOverrides over the normal macro goal and re-derives calories', () => {
    const user = makeUser();
    const ketoCycle = makeCycle({ targetOverrides: { carbs: 20 } });
    const result = getEffectiveDailyTargets(user, [ketoCycle], '2026-01-05');
    expect(result.targetsSuppressed).toBe(false);
    expect(result.macroGoal).toEqual({ carbs: 20, protein: 150, fat: 65 });
    // 20*4 + 150*4 + 65*9 = 80 + 600 + 585 = 1265
    expect(result.calorieGoal).toBe(1265);
  });
});

describe('getDayComplianceStatus', () => {
  it('is exempt regardless of calories when targets are suppressed', () => {
    expect(
      getDayComplianceStatus({ totalCalories: 5000, hasEntries: true, targetsSuppressed: true, calorieGoal: 2000 }),
    ).toBe('exempt');
  });

  it('is none when nothing was logged', () => {
    expect(
      getDayComplianceStatus({ totalCalories: 0, hasEntries: false, targetsSuppressed: false, calorieGoal: 2000 }),
    ).toBe('none');
  });

  it('is met within the tolerance band around the goal', () => {
    expect(
      getDayComplianceStatus({ totalCalories: 2000, hasEntries: true, targetsSuppressed: false, calorieGoal: 2000 }),
    ).toBe('met');
    expect(
      getDayComplianceStatus({ totalCalories: 1800, hasEntries: true, targetsSuppressed: false, calorieGoal: 2000 }),
    ).toBe('met');
  });

  it('is missed outside the tolerance band', () => {
    expect(
      getDayComplianceStatus({ totalCalories: 3000, hasEntries: true, targetsSuppressed: false, calorieGoal: 2000 }),
    ).toBe('missed');
    expect(
      getDayComplianceStatus({ totalCalories: 800, hasEntries: true, targetsSuppressed: false, calorieGoal: 2000 }),
    ).toBe('missed');
  });

  it('requires protein and carbs to also be reached, not just calories', () => {
    expect(
      getDayComplianceStatus({
        totalCalories: 2000,
        hasEntries: true,
        targetsSuppressed: false,
        calorieGoal: 2000,
        totalProtein: 90,
        proteinGoal: 150,
        totalCarbs: 200,
        carbGoal: 200,
      }),
    ).toBe('missed');
  });

  it('is met when calories, protein and carbs are all reached (overshooting protein/carbs is fine)', () => {
    expect(
      getDayComplianceStatus({
        totalCalories: 2000,
        hasEntries: true,
        targetsSuppressed: false,
        calorieGoal: 2000,
        totalProtein: 160,
        proteinGoal: 150,
        totalCarbs: 210,
        carbGoal: 200,
      }),
    ).toBe('met');
  });
});
