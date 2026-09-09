jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let authCallback: ((event: string, session: unknown) => void) | undefined;
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
      },
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn(),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      upsert: mockUpsert,
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { addMealAndSync, updateMealAndSync } from '@/services/diaryActions';
import { useDiaryStore, todayKey } from '@/store/diaryStore';
import { useSyncStore } from '@/store/syncStore';

function flush() {
  return new Promise<void>((resolve) => setImmediate(() => resolve()));
}

const foodA = {
  id: 'food-a',
  name: 'Apfel',
  caloriesPerServing: 50,
  macrosPerServing: { carbs: 14, protein: 0, fat: 0 },
  micronutrientsPerServing: {},
  servingSize: 100,
  servingUnit: 'g',
};

const foodB = {
  id: 'food-b',
  name: 'Banane',
  caloriesPerServing: 90,
  macrosPerServing: { carbs: 23, protein: 1, fat: 0 },
  micronutrientsPerServing: {},
  servingSize: 100,
  servingUnit: 'g',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useDiaryStore.setState({ entriesByDate: {} });
  mockUpsert.mockClear();
});

// Each addMealAndSync call reads the current diary state, pushes a FULL
// snapshot, and only commits locally after that push succeeds. Without
// serialization, firing two calls back-to-back (before the first's push has
// resolved) would let the second read the state from BEFORE the first
// committed - its push would overwrite the server with a snapshot missing
// the first meal, a lost update, even though both calls individually
// "succeed".
it('serializes back-to-back meal additions so neither push drops the other', async () => {
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u1' }, access_token: 'tok-1' });
  await flush();
  await flush();

  const date = todayKey();
  const [first, second] = [addMealAndSync(date, foodA, 'lunch', 1), addMealAndSync(date, foodB, 'dinner', 1)];
  await Promise.all([first, second]);

  const entries = useDiaryStore.getState().entriesByDate[date] ?? [];
  expect(entries).toHaveLength(2);
  expect(entries.map((e) => e.foodItem.id).sort()).toEqual(['food-a', 'food-b']);

  // Two separate user actions -> two separate pushes (not merged into one),
  // but the second push's payload must contain BOTH entries, proving it was
  // built from post-first-commit state rather than a stale pre-commit read.
  expect(mockUpsert).toHaveBeenCalledTimes(2);
  const secondPushPayload = mockUpsert.mock.calls[1][0];
  expect(secondPushPayload.data.entriesByDate[date]).toHaveLength(2);
});

describe('updateMealAndSync', () => {
  it('edits grams and meal type locally when signed out', async () => {
    // An earlier test in this file may have already signed in - force logged-out
    // explicitly so this exercises the local-only branch, not push-then-commit.
    useSyncStore.setState({ session: null });

    const date = todayKey();
    useDiaryStore.getState().addEntry(date, foodA, 'breakfast', 1);
    const entryId = useDiaryStore.getState().entriesByDate[date][0].id;

    await updateMealAndSync(date, entryId, { servings: 2, mealType: 'dinner' });

    const entry = useDiaryStore.getState().entriesByDate[date][0];
    expect(entry.servings).toBe(2);
    expect(entry.mealType).toBe('dinner');
  });

  it('pushes the updated entry to Supabase before committing it locally when signed in', async () => {
    useSyncStore.getState().init();
    authCallback?.('INITIAL_SESSION', { user: { id: 'u2' }, access_token: 'tok-2' });
    await flush();
    await flush();

    const date = todayKey();
    await addMealAndSync(date, foodA, 'breakfast', 1);
    const entryId = useDiaryStore.getState().entriesByDate[date][0].id;
    mockUpsert.mockClear();

    await updateMealAndSync(date, entryId, { servings: 1.5, mealType: 'snack' });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const pushedEntries = mockUpsert.mock.calls[0][0].data.entriesByDate[date];
    expect(pushedEntries[0].servings).toBe(1.5);
    expect(pushedEntries[0].mealType).toBe('snack');
    expect(useDiaryStore.getState().entriesByDate[date][0].servings).toBe(1.5);
  });
});
