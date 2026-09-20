import { buildSnapshot, isBaselineMissingError, mergeRemoteDiary, pushSnapshotData, recordLocalChange } from '@/services/cloudSync';
import { countDiaryEntries } from '@/services/localBackup';
import { isNetworkError, useOfflineQueueStore } from '@/services/offlineQueue';
import { makeEntryId, useDiaryStore, type MealEntryUpdate } from '@/store/diaryStore';
import { useRewardStore } from '@/store/rewardStore';
import { describeSyncError, useSyncStore, withSyncSuppressed } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { useUserStore } from '@/store/userStore';
import type { FoodItem, MealEntry, MealType } from '@/types';

function showFailureToast(message: string) {
  useToastStore.getState().show(`Sync fehlgeschlagen: ${message}`, 'error');
}

/** Advances the daily streak and checks the calorie/protein-goal reward for `date`, reading the diary state fresh so it reflects the entries just committed. */
function applyMealRewards(date: string) {
  const entries = useDiaryStore.getState().entriesByDate[date] ?? [];
  const consumedCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const consumedProtein = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);
  const { dailyCalorieGoal, dailyMacroGoal } = useUserStore.getState().user;

  useRewardStore.getState().recordDailyActivity(date);
  useRewardStore.getState().checkCalorieProteinGoal({
    consumedCalories,
    calorieGoal: dailyCalorieGoal,
    consumedProtein,
    proteinGoal: dailyMacroGoal.protein,
    dateKey: date,
  });
}

// Serializes every online write-then-commit mutation so a second add/remove
// that starts while the first is still in flight waits for it to finish
// first. Each mutation reads the current diary state fresh and pushes a FULL
// snapshot, so running two concurrently would let the second silently
// overwrite the first's not-yet-committed change - a lost update, not just a
// UI race.
let mutationQueue: Promise<void> = Promise.resolve();

function enqueue(mutation: () => Promise<void>): Promise<void> {
  const run = mutationQueue.then(mutation);
  mutationQueue = run.catch(() => {});
  return run;
}

// Supabase user_data is the single source of truth here: local state is only
// ever touched AFTER the push has succeeded. On failure nothing is applied
// locally at all - "rollback" is simply that the mutation never happened.
async function pushDiaryThenCommit(
  nextEntriesByDate: Record<string, MealEntry[]>,
  changedDates: string[],
  userId: string,
): Promise<void> {
  useSyncStore.setState({ status: 'syncing', error: null });
  const snapshot = { ...buildSnapshot(), entriesByDate: nextEntriesByDate };

  let updatedAt: string;
  try {
    updatedAt = await pushSnapshotData(userId, snapshot);
  } catch (err) {
    if (isBaselineMissingError(err)) {
      // Signed in, but this session never managed to read the remote row (expired
      // JWT / flaky connection at launch), so pushing would risk overwriting it.
      // Keep the meal locally, and kick the catch-up pull - once it succeeds,
      // syncStore merges the remote diary in and pushes the combined result.
      changedDates.forEach((changedDate) => useOfflineQueueStore.getState().markPending(changedDate));
      withSyncSuppressed(() => {
        useDiaryStore.setState({ entriesByDate: nextEntriesByDate });
      });
      // The suppressed commit above skips the change-watcher, so record the edit
      // explicitly: it's what stops the catch-up pull from treating this device's
      // state as older than the remote row and overwriting the meal just logged.
      await recordLocalChange();
      useSyncStore.setState({ status: 'error', error: 'Cloud-Daten werden geladen – wird synchronisiert, sobald möglich.' });
      useSyncStore.getState().reconnect();
      return;
    }
    if (isNetworkError(err)) {
      // Offline: commit the mutation locally right away (optimistic UI -
      // makeEntryId() below already hands out a permanent client-side id, so
      // there's no server id to reconcile later) instead of losing it, and
      // leave status 'error' for store/syncStore.ts's existing reconnect
      // listener to retry. That retry pushes the FULL current snapshot,
      // which already contains this change - see services/syncManager.ts.
      useOfflineQueueStore.getState().setOnline(false);
      changedDates.forEach((changedDate) => useOfflineQueueStore.getState().markPending(changedDate));
      withSyncSuppressed(() => {
        useDiaryStore.setState({ entriesByDate: nextEntriesByDate });
      });
      useSyncStore.setState({ status: 'error', error: 'Offline – wird synchronisiert, sobald wieder online.' });
      return;
    }
    const message = describeSyncError(err);
    useSyncStore.setState({ status: 'error', error: message });
    showFailureToast(message);
    throw err;
  }

  withSyncSuppressed(() => {
    useDiaryStore.setState({ entriesByDate: nextEntriesByDate });
  });
  useSyncStore.setState({ status: 'synced', lastSyncedAt: updatedAt, remoteUpdatedAt: updatedAt, error: null });
}

function pushThenCommit(date: string, nextEntriesForDate: MealEntry[], userId: string): Promise<void> {
  const nextEntriesByDate = { ...useDiaryStore.getState().entriesByDate, [date]: nextEntriesForDate };
  return pushDiaryThenCommit(nextEntriesByDate, [date], userId);
}

interface PendingMeal {
  foodItem: FoodItem;
  mealType: MealType;
  servings: number;
}

/** Adds one or more meals as a single push (one user action = one upsert, not one per item). */
export function addMealsAndSync(date: string, meals: PendingMeal[]): Promise<void> {
  const session = useSyncStore.getState().session;
  if (!session) {
    // Not signed in: nothing to push against - same local-only behavior as before.
    for (const meal of meals) {
      useDiaryStore.getState().addEntry(date, meal.foodItem, meal.mealType, meal.servings);
    }
    applyMealRewards(date);
    return Promise.resolve();
  }

  return enqueue(async () => {
    const newEntries: MealEntry[] = meals.map((meal) => ({
      id: makeEntryId(),
      foodItem: meal.foodItem,
      mealType: meal.mealType,
      servings: meal.servings,
      loggedAt: new Date().toISOString(),
    }));
    const currentEntries = useDiaryStore.getState().entriesByDate[date] ?? [];
    await pushThenCommit(date, [...currentEntries, ...newEntries], session.user.id);
    applyMealRewards(date);
  });
}

export function addMealAndSync(date: string, foodItem: FoodItem, mealType: MealType, servings: number): Promise<void> {
  return addMealsAndSync(date, [{ foodItem, mealType, servings }]);
}

export function removeMealAndSync(date: string, entryId: string): Promise<void> {
  const session = useSyncStore.getState().session;
  if (!session) {
    useDiaryStore.getState().removeEntry(date, entryId);
    return Promise.resolve();
  }

  return enqueue(async () => {
    const currentEntries = useDiaryStore.getState().entriesByDate[date] ?? [];
    const nextEntries = currentEntries.filter((entry) => entry.id !== entryId);
    await pushThenCommit(date, nextEntries, session.user.id);
  });
}

/** Duplicates one already-logged entry onto `toDate` (same or a different day) - reuses `addMealsAndSync` so it gets the same sync/reward handling as any other new entry. No-op if the source entry no longer exists. */
export function copyEntryAndSync(fromDate: string, entryId: string, toDate: string): Promise<void> {
  const entry = useDiaryStore.getState().entriesByDate[fromDate]?.find((candidate) => candidate.id === entryId);
  if (!entry) return Promise.resolve();
  return addMealsAndSync(toDate, [{ foodItem: entry.foodItem, mealType: entry.mealType, servings: entry.servings }]);
}

/** Duplicates every entry of one meal section (e.g. all of Frühstück) onto `toDate` as a single sync push. No-op if the section is empty. */
export function copyMealAndSync(fromDate: string, mealType: MealType, toDate: string): Promise<void> {
  const entries = (useDiaryStore.getState().entriesByDate[fromDate] ?? []).filter((entry) => entry.mealType === mealType);
  if (entries.length === 0) return Promise.resolve();
  const meals: PendingMeal[] = entries.map((entry) => ({ foodItem: entry.foodItem, mealType, servings: entry.servings }));
  return addMealsAndSync(toDate, meals);
}

/** Edits an already-logged entry in place (weight/grams, meal type, ...) - same push-then-commit guarantee as add/remove. */
export function updateMealAndSync(date: string, entryId: string, changes: MealEntryUpdate): Promise<void> {
  const session = useSyncStore.getState().session;
  if (!session) {
    useDiaryStore.getState().updateEntry(date, entryId, changes);
    return Promise.resolve();
  }

  return enqueue(async () => {
    const currentEntries = useDiaryStore.getState().entriesByDate[date] ?? [];
    const nextEntries = currentEntries.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry));
    await pushThenCommit(date, nextEntries, session.user.id);
  });
}

/**
 * Merges entries from a local backup file into the diary and, when signed in,
 * pushes the merged diary through the same write-then-commit path as any other
 * mutation (so a failed push leaves local state untouched). Additive only:
 * entries whose id already exists are never overwritten, and no rewards/streak
 * side effects fire - importing must not be a way to farm coins. Resolves with
 * the number of entries actually added.
 */
export async function importDiaryEntriesAndSync(imported: Record<string, MealEntry[]>): Promise<number> {
  let added = 0;
  await enqueue(async () => {
    // Read inside the queue so a meal logged while the file was being picked is included.
    const current = useDiaryStore.getState().entriesByDate;
    const merged = mergeRemoteDiary(current, imported);
    added = countDiaryEntries(merged) - countDiaryEntries(current);
    if (added === 0) return;

    const session = useSyncStore.getState().session;
    if (!session) {
      useDiaryStore.setState({ entriesByDate: merged, lastUpdatedAt: new Date().toISOString() });
      return;
    }
    const changedDates = Object.keys(merged).filter((date) => merged[date] !== current[date]);
    await pushDiaryThenCommit(merged, changedDates, session.user.id);
  });
  return added;
}
