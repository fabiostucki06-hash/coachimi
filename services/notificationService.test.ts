jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  getInactivityReference,
  getLastMealLoggedAt,
  getNextOccurrence,
  shouldShowInactivityReminder,
} from '@/services/notificationService';
import type { MealEntry } from '@/types';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 21, hour, minute, 0, 0);
}

function entry(loggedAt: Date): MealEntry {
  return { id: loggedAt.toISOString(), foodItem: {} as MealEntry['foodItem'], mealType: 'snack', servings: 1, loggedAt: loggedAt.toISOString() };
}

describe('getNextOccurrence', () => {
  it('returns today when the time has not passed yet', () => {
    expect(getNextOccurrence(13, 0, at(9))).toEqual(at(13));
  });

  it('rolls to tomorrow once the time has passed, including exactly at the time', () => {
    const tomorrow = new Date(2026, 8, 22, 8, 0, 0, 0);
    expect(getNextOccurrence(8, 0, at(9))).toEqual(tomorrow);
    expect(getNextOccurrence(8, 0, at(8))).toEqual(tomorrow);
  });
});

describe('getLastMealLoggedAt', () => {
  it('returns null for an empty diary', () => {
    expect(getLastMealLoggedAt({})).toBeNull();
  });

  it('finds the newest loggedAt across all days and ignores unparseable ones', () => {
    const bad = { ...entry(at(9)), loggedAt: 'nope' };
    const result = getLastMealLoggedAt({
      '2026-09-20': [entry(new Date(2026, 8, 20, 22))],
      '2026-09-21': [entry(at(9)), bad, entry(at(12, 30))],
    });
    expect(result).toBe(at(12, 30).getTime());
  });
});

describe('shouldShowInactivityReminder', () => {
  it('fires only after more than 4h since the last meal', () => {
    const last = at(9).getTime();
    expect(shouldShowInactivityReminder(at(13), last)).toBe(false);
    expect(shouldShowInactivityReminder(at(13, 1), last)).toBe(true);
  });

  it('counts an empty day from the start of daytime (08:00)', () => {
    expect(shouldShowInactivityReminder(at(12), null)).toBe(false);
    expect(shouldShowInactivityReminder(at(12, 1), null)).toBe(true);
  });

  it("does not treat last night's meal as an overdue morning", () => {
    const lastNight = new Date(2026, 8, 20, 19).getTime();
    expect(shouldShowInactivityReminder(at(9), lastNight)).toBe(false);
    expect(getInactivityReference(at(9), lastNight)).toBe(at(8).getTime());
  });

  it('stays quiet outside daytime hours', () => {
    const last = at(1).getTime();
    expect(shouldShowInactivityReminder(at(7, 30), last)).toBe(false);
    expect(shouldShowInactivityReminder(at(21), at(12).getTime())).toBe(false);
    expect(shouldShowInactivityReminder(at(23), at(12).getTime())).toBe(false);
  });
});
