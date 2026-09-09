import { buildSnapshot, pushSnapshotData } from '@/services/cloudSync';
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
async function pushThenCommit(date: string, nextEntriesForDate: MealEntry[], userId: string): Promise<void> {
  useSyncStore.setState({ status: 'syncing', error: null });
  const nextEntriesByDate = { ...useDiaryStore.getState().entriesByDate, [date]: nextEntriesForDate };
  const snapshot = { ...buildSnapshot(), entriesByDate: nextEntriesByDate };

  let updatedAt: string;
  try {
    updatedAt = await pushSnapshotData(userId, snapshot);
  } catch (err) {
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
