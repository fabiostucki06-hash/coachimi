jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { isBaselineMissingError, mergeRemoteDiary, pushSnapshotData } from '@/services/cloudSync';
import type { MealEntry } from '@/types';

function entry(id: string, loggedAt: string): MealEntry {
  return {
    id,
    foodItem: { id: `food-${id}`, name: id } as MealEntry['foodItem'],
    mealType: 'lunch',
    servings: 1,
    loggedAt,
  };
}

describe('mergeRemoteDiary', () => {
  it('returns the very same local object when there is nothing to add', () => {
    const local = { '2026-09-16': [entry('a', '2026-09-16T08:00:00.000Z')] };
    expect(mergeRemoteDiary(local, undefined)).toBe(local);
    expect(mergeRemoteDiary(local, { '2026-09-16': [entry('a', '2026-09-16T08:00:00.000Z')] })).toEqual(local);
  });

  it('adds whole days that only exist remotely (the days another device logged)', () => {
    const local = { '2026-09-16': [entry('a', '2026-09-16T08:00:00.000Z')] };
    const remote = { '2026-09-18': [entry('b', '2026-09-18T08:00:00.000Z')] };
    expect(Object.keys(mergeRemoteDiary(local, remote)).sort()).toEqual(['2026-09-16', '2026-09-18']);
  });

  it('unions entries of a shared day by id without dropping or duplicating any', () => {
    const local = { d: [entry('a', '2026-09-18T08:00:00.000Z'), entry('c', '2026-09-18T12:00:00.000Z')] };
    const remote = { d: [entry('a', '2026-09-18T08:00:00.000Z'), entry('b', '2026-09-18T10:00:00.000Z')] };
    expect(mergeRemoteDiary(local, remote).d.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('never lets an emptied local day (all entries deleted) be replaced by nothing - local day key wins', () => {
    const merged = mergeRemoteDiary({ d: [] }, { d: [] });
    expect(merged.d).toEqual([]);
  });
});

describe('pushSnapshotData', () => {
  it('refuses to write before the remote row has been read', async () => {
    const error = await pushSnapshotData('nobody', {} as never).catch((err) => err);
    expect(isBaselineMissingError(error)).toBe(true);
  });
});
