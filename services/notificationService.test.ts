jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  DAILY_REMINDERS,
  formatInactivityGap,
  getInactivityReference,
  getLastMealLoggedAt,
  getNextOccurrence,
  reminderTag,
  shouldShowInactivityReminder,
} from '@/services/notificationService';
import type { MealEntry } from '@/types';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 21, hour, minute, 0, 0);
}

function entry(loggedAt: Date): MealEntry {
  return { id: loggedAt.toISOString(), foodItem: {} as MealEntry['foodItem'], mealType: 'snack', servings: 1, loggedAt: loggedAt.toISOString() };
}

describe('reminderTag', () => {
  // A shared tag would make every reminder after the first silently replace
  // the one already in the tray instead of raising a system banner, so the
  // three daily slots must never collide.
  it('gives every daily reminder its own tag', () => {
    const tags = DAILY_REMINDERS.map((reminder) => reminderTag(reminder.id));
    expect(new Set(tags).size).toBe(DAILY_REMINDERS.length);
  });

  // These exact strings are what supabase/functions/send-push-reminders sends,
  // which is what lets a push and the local timer for the same slot dedupe.
  it('matches the tags the push edge function sends', () => {
    expect(DAILY_REMINDERS.map((reminder) => reminderTag(reminder.id))).toEqual([
      'coachimi-breakfast',
      'coachimi-lunch',
      'coachimi-dinner',
    ]);
  });
});

describe('formatInactivityGap', () => {
  it('rounds down to whole hours and singularizes the first one', () => {
    expect(formatInactivityGap(4 * 60 * 60 * 1000 + 1)).toBe('4 Stunden');
    expect(formatInactivityGap(90 * 60 * 1000)).toBe('1 Stunde');
  });
});

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
