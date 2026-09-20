import { caloriesFromMacros } from '@/utils/nutritionCalculator';
import type { DietCycle, DietCycleType, Macros, User } from '@/types';

/** Calendar range-highlight color + short label per cycle type - "Purple for Keto (strict), Amber for Cheat" per the feature spec, plus maintenance/custom variants. */
export const CYCLE_TYPE_META: Record<DietCycleType, { color: string; label: string }> = {
  strict: { color: '#8B5CF6', label: 'Strikte Phase' },
  cheat: { color: '#F59E0B', label: 'Cheat / Refeed' },
  maintenance: { color: '#10B981', label: 'Erhaltungsphase' },
  custom: { color: '#6366F1', label: 'Individuell' },
};

/** The cycle active on a given date, or null outside of any cycle. If two cycles were ever created with overlapping ranges (not prevented client-side), the most-recently-added one (last in the array) wins - simplest deterministic tiebreak given cycles are stored in insertion order. */
export function getActiveCycle(cycles: DietCycle[], dateKey: string): DietCycle | null {
  const matches = cycles.filter((cycle) => cycle.startDate <= dateKey && dateKey <= cycle.endDate);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

export interface EffectiveDailyTargets {
  cycle: DietCycle | null;
  /** true = the active cycle hides daily goal warnings/progress bars entirely (a Cheat/Break period) - render the "Cheat / Break Period" badge instead. */
  targetsSuppressed: boolean;
  calorieGoal: number;
  macroGoal: Macros;
}

/**
 * The macro/calorie goal actually in effect for `dateKey`, after applying
 * whichever diet cycle covers it: a targetDisabled cycle (Cheat/Refeed)
 * suppresses the goal entirely, a cycle with targetOverrides (e.g. a Keto
 * phase capping carbs) merges those grams over the user's normal goal, and no
 * active cycle just returns the user's normal goal unchanged.
 */
export function getEffectiveDailyTargets(user: User, cycles: DietCycle[], dateKey: string): EffectiveDailyTargets {
  const cycle = getActiveCycle(cycles, dateKey);
  if (!cycle) {
    return { cycle: null, targetsSuppressed: false, calorieGoal: user.dailyCalorieGoal, macroGoal: user.dailyMacroGoal };
  }
  if (cycle.targetDisabled) {
    return { cycle, targetsSuppressed: true, calorieGoal: user.dailyCalorieGoal, macroGoal: user.dailyMacroGoal };
  }
  if (cycle.targetOverrides) {
    const macroGoal: Macros = { ...user.dailyMacroGoal, ...cycle.targetOverrides };
    return { cycle, targetsSuppressed: false, calorieGoal: caloriesFromMacros(macroGoal), macroGoal };
  }
  return { cycle, targetsSuppressed: false, calorieGoal: user.dailyCalorieGoal, macroGoal: user.dailyMacroGoal };
}

export type DayComplianceStatus = 'met' | 'missed' | 'exempt' | 'none';

// A day counts as "met" within this band around the goal rather than only
// "at or under" it - a diet target is a moving-average aim, not a hard
// ceiling, so someone 5% over or noticeably under (under-eating is its own
// miss, not a free pass) shouldn't read as a red "missed" day.
const COMPLIANCE_LOWER_BAND = 0.85;
const COMPLIANCE_UPPER_BAND = 1.1;

/**
 * Target-compliance status for one already-passed day, for the calendar's
 * per-day status dot. 'exempt' (a cheat/off day) always wins over the
 * macro math - those days are excluded from compliance rating by design,
 * per the feature spec. 'none' means "nothing to rate" (no entries logged,
 * or no calorie goal to rate against).
 *
 * A day only counts as 'met' when all three of calories, protein AND carbs
 * were reached - matching store/rewardStore.ts's checkCalorieProteinGoal
 * wording ("Kalorienziel/Proteinziel erreicht"), extended to carbs per the
 * same "erreicht" (reached) meaning: calories stay in the existing tolerance
 * band (over-eating is still a miss, not a free pass), while protein/carbs
 * just need to be at or above their goal - overshooting either isn't
 * penalized the way overshooting calories is. A goal of 0 (e.g. carnivore's
 * carb target) is treated as always satisfied, since there's nothing to reach.
 */
export function getDayComplianceStatus(params: {
  totalCalories: number;
  hasEntries: boolean;
  targetsSuppressed: boolean;
  calorieGoal: number;
  totalProtein?: number;
  proteinGoal?: number;
  totalCarbs?: number;
  carbGoal?: number;
}): DayComplianceStatus {
  if (params.targetsSuppressed) return 'exempt';
  if (!params.hasEntries || params.calorieGoal <= 0) return 'none';

  const calorieMet =
    params.totalCalories >= params.calorieGoal * COMPLIANCE_LOWER_BAND && params.totalCalories <= params.calorieGoal * COMPLIANCE_UPPER_BAND;
  const proteinMet = !params.proteinGoal || params.proteinGoal <= 0 || (params.totalProtein ?? 0) >= params.proteinGoal;
  const carbsMet = !params.carbGoal || params.carbGoal <= 0 || (params.totalCarbs ?? 0) >= params.carbGoal;

  return calorieMet && proteinMet && carbsMet ? 'met' : 'missed';
}
