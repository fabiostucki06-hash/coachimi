import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { useDiaryStore } from '@/store/diaryStore';
import { useRewardStore } from '@/store/rewardStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useUserStore } from '@/store/userStore';
import type {
  BadgeId,
  BorderId,
  FoodItem,
  IconPackId,
  MealEntry,
  PerkId,
  RankId,
  RewardTransaction,
  ThemeId,
  User,
  WeightEntry,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types';

const LOCAL_CHANGE_KEY = 'coach-imi-last-local-change';
const SYNC_TIMEOUT_MS = 10000;

// Supabase-js doesn't impose a timeout on its own — a hung connection would
// otherwise leave a push/pull promise unsettled forever, which would in turn
// leave the sync store's status stuck on 'syncing' indefinitely with no error
// ever surfacing (the "sync worked once, then locked up" symptom). Race
// against a timer so the call is always guaranteed to settle one way or the
// other.
function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: Zeitüberschreitung.`)), SYNC_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Tracks when local state last changed, independent of whether the debounced
// push to Supabase has actually landed yet. Used to make sure a reload can
// never let an older/missing remote snapshot clobber a newer local edit that
// just hasn't finished syncing — see pullSnapshot's `updatedAt`.
export async function recordLocalChange(): Promise<void> {
  await AsyncStorage.setItem(LOCAL_CHANGE_KEY, new Date().toISOString());
}

export async function getLocalChangeTimestamp(): Promise<string | null> {
  return AsyncStorage.getItem(LOCAL_CHANGE_KEY);
}

// Only let a pulled snapshot overwrite local state if it's actually newer than
// the last local edit (or there is no local edit on record yet, e.g. a fresh
// device). Otherwise a hard refresh shortly after an edit — before the
// debounced auto-sync push lands — would pull back the stale pre-edit row and
// silently discard the edit.
export function shouldApplyRemote(remoteUpdatedAt: string | null | undefined, localChangedAt: string | null): boolean {
  if (!localChangedAt) return true;
  if (!remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() > new Date(localChangedAt).getTime();
}

// Which user's remote row this session has successfully READ at least once.
// Every push replaces the whole JSONB snapshot, so pushing from a device that
// never managed to read the remote row first (pull failed with an expired JWT
// on cold start, offline, ...) can overwrite days of diary entries logged on
// another device with this device's stale copy. pushSnapshotData refuses to
// write until a pull has succeeded - see store/syncStore.ts's establishBaseline.
let baselineUserId: string | null = null;

export function markRemoteBaselineLoaded(userId: string): void {
  baselineUserId = userId;
}

export function clearRemoteBaseline(): void {
  baselineUserId = null;
}

export function hasRemoteBaseline(userId: string): boolean {
  return baselineUserId === userId;
}

const BASELINE_MISSING_CODE = 'REMOTE_BASELINE_MISSING';

export function isBaselineMissingError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === BASELINE_MISSING_CODE;
}

// supabase-js surfaces an expired/invalid access token as HTTP 401 (PostgREST
// PGRST301 / "JWT expired") on the response, not as a thrown exception.
function isAuthFailure(result: { status?: number; error: { code?: string; message?: string } | null }): boolean {
  if (!result.error) return false;
  return result.status === 401 || result.error.code === 'PGRST301' || /jwt (expired|invalid)|invalid jwt/i.test(result.error.message ?? '');
}

// Adds entries the remote copy has and the local copy lacks, never removing or
// replacing a local entry. Used only when a pulled snapshot can't simply be
// applied because this device has unsynced local edits: the old behavior kept
// the local diary as-is and then pushed it, silently discarding every day
// another device had logged in the meantime. Worst case here is a locally
// deleted entry reappearing (cheap to delete again) instead of a logged meal
// vanishing for good.
export function mergeRemoteDiary(
  local: Record<string, MealEntry[]>,
  remote: Record<string, MealEntry[]> | undefined,
): Record<string, MealEntry[]> {
  if (!remote) return local;
  const merged: Record<string, MealEntry[]> = { ...local };
  for (const [date, remoteEntries] of Object.entries(remote)) {
    const localEntries = local[date];
    if (!localEntries) {
      merged[date] = remoteEntries;
      continue;
    }
    const localIds = new Set(localEntries.map((entry) => entry.id));
    const missing = remoteEntries.filter((entry) => !localIds.has(entry.id));
    if (missing.length > 0) {
      merged[date] = [...localEntries, ...missing].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    }
  }
  return merged;
}

// Reward fields synced across devices - gamification state (Streaks, Ränge,
// Schutzschilde). All optional: absent in snapshots pushed before this
// gamification feature existed - callers must fall back to the local default.
// The Goldbarren/coin balance itself is deliberately NOT here - it lives in
// profiles.coins and is fetched/mutated directly via store/coinsStore.ts
// (see supabase/migrations/0004_backend_coins.sql), not synced through this
// client-computed JSONB blob.
export interface CloudRewardSnapshot {
  streak: number;
  lastActiveDate: string | null;
  lastDailyClaimDate: string | null;
  lastGoalRewardDate: string | null;
  lastStreakRewardStreak: number;
  rewardedSessionIds: string[];
  unlockedBadges: BadgeId[];
  transactionHistory: RewardTransaction[];
  streakSavers: number;
  activeRank: RankId;
  unlockedRanks: RankId[];
  // Optional: absent in snapshots pushed before the Coin Shop's cosmetics existed -
  // callers must fall back to the local default (see rewardStore.ts's initial state).
  activeTheme?: ThemeId;
  unlockedThemes?: ThemeId[];
  activeIconPack?: IconPackId;
  unlockedIconPacks?: IconPackId[];
  activeBorder?: BorderId;
  unlockedBorders?: BorderId[];
  unlockedPerks?: PerkId[];
}

// Training data (workout templates + logged sessions) synced across devices.
// Optional, same as `rewards`: absent in snapshots pushed before this existed
// - callers must leave the local training store untouched rather than wipe it.
export interface CloudTrainingSnapshot {
  templates: WorkoutTemplate[];
  sessionsByDate: Record<string, WorkoutSession[]>;
}

export interface CloudSnapshot {
  user: User;
  weightHistory: WeightEntry[];
  entriesByDate: Record<string, MealEntry[]>;
  hasOnboarded: boolean;
  // Optional: absent in snapshots pushed before custom foods existed - callers must fall back to [].
  customFoods?: FoodItem[];
  rewards?: CloudRewardSnapshot;
  training?: CloudTrainingSnapshot;
}

export function buildSnapshot(): CloudSnapshot {
  const { user, weightHistory, hasOnboarded } = useUserStore.getState();
  const { entriesByDate } = useDiaryStore.getState();
  const { customFoods } = useCustomFoodStore.getState();
  const {
    streak,
    lastActiveDate,
    lastDailyClaimDate,
    lastGoalRewardDate,
    lastStreakRewardStreak,
    rewardedSessionIds,
    unlockedBadges,
    transactionHistory,
    streakSavers,
    activeRank,
    unlockedRanks,
    activeTheme,
    unlockedThemes,
    activeIconPack,
    unlockedIconPacks,
    activeBorder,
    unlockedBorders,
    unlockedPerks,
  } = useRewardStore.getState();
  const { templates, sessionsByDate: trainingSessionsByDate } = useTrainingStore.getState();

  return {
    user,
    weightHistory,
    entriesByDate,
    hasOnboarded,
    customFoods,
    rewards: {
      streak,
      lastActiveDate,
      lastDailyClaimDate,
      lastGoalRewardDate,
      lastStreakRewardStreak,
      rewardedSessionIds,
      unlockedBadges,
      transactionHistory,
      streakSavers,
      activeRank,
      unlockedRanks,
      activeTheme,
      unlockedThemes,
      activeIconPack,
      unlockedIconPacks,
      activeBorder,
      unlockedBorders,
      unlockedPerks,
    },
    training: { templates, sessionsByDate: trainingSessionsByDate },
  };
}

export function applySnapshot(snapshot: CloudSnapshot): void {
  useUserStore.setState((state) => ({
    user: { ...state.user, ...snapshot.user },
    weightHistory: snapshot.weightHistory ?? state.weightHistory,
    hasOnboarded: snapshot.hasOnboarded ?? state.hasOnboarded,
  }));
  useDiaryStore.setState({
    entriesByDate: snapshot.entriesByDate ?? {},
  });
  useCustomFoodStore.setState({
    customFoods: snapshot.customFoods ?? [],
  });
  if (snapshot.rewards) {
    useRewardStore.setState({ ...snapshot.rewards });
  }
  if (snapshot.training) {
    useTrainingStore.setState({
      templates: snapshot.training.templates ?? [],
      sessionsByDate: snapshot.training.sessionsByDate ?? {},
    });
  }
}

// Set on every push and checked by the realtime handler so a device doesn't
// treat its own write echoing back through `postgres_changes` as a remote
// change and redundantly re-apply/re-fetch its own just-pushed data.
let lastPushedUpdatedAt: string | null = null;

// Low-level push of an explicit snapshot, rather than whatever buildSnapshot()
// reads off the stores right now - needed by the write-then-commit mutation
// flow (services/diaryActions.ts), which must push the *prospective* next
// state to Supabase before it's allowed to touch local state at all.
export async function pushSnapshotData(userId: string, snapshot: CloudSnapshot): Promise<string> {
  if (!hasRemoteBaseline(userId)) {
    throw Object.assign(new Error('Cloud-Daten wurden noch nicht geladen - Speichern übersprungen, um nichts zu überschreiben.'), {
      code: BASELINE_MISSING_CODE,
    });
  }
  const updatedAt = new Date().toISOString();
  const { error } = await withTimeout(
    // Explicit onConflict: without it, upsert() resolves conflicts against
    // the table's primary key. If the live table's actual PK isn't user_id
    // (e.g. a separate generated `id` column, with user_id only UNIQUE),
    // that silently attempts an INSERT instead of an UPDATE and fails with
    // "duplicate key value violates unique constraint user_data_user_id_key".
    // Naming the conflict target explicitly makes this correct regardless of
    // which column is actually the PK.
    supabase.from('user_data').upsert({ user_id: userId, data: snapshot, updated_at: updatedAt }, { onConflict: 'user_id' }),
    'Sync-Push',
  );
  if (error) {
    console.error('[Sync] Error:', error);
    throw error;
  }
  lastPushedUpdatedAt = updatedAt;
  return updatedAt;
}

export async function pushSnapshot(userId: string): Promise<string> {
  return pushSnapshotData(userId, buildSnapshot());
}

export interface RemoteSnapshot {
  snapshot: CloudSnapshot;
  updatedAt: string | null;
}

export async function pullSnapshot(userId: string): Promise<RemoteSnapshot | null> {
  const selectRow = () =>
    withTimeout(supabase.from('user_data').select('data, updated_at').eq('user_id', userId).maybeSingle(), 'Sync-Pull');

  let result = await selectRow();
  // Cold start / wake from background: the persisted access token can already be
  // expired when this first request goes out (INITIAL_SESSION fires before the
  // background refresh lands). Refresh explicitly and retry once instead of
  // giving up - a failed first pull used to leave this device without a
  // baseline while its local (stale) state got pushed over the remote row.
  if (isAuthFailure(result)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) result = await selectRow();
  }

  const { data, error } = result;
  if (error) {
    console.error('[Sync] Error:', error);
    throw error;
  }
  if (!data?.data) return null;
  return { snapshot: data.data as CloudSnapshot, updatedAt: (data.updated_at as string | undefined) ?? null };
}

// Listens for another device/session pushing a new snapshot for this user
// (requires `user_data` to be added to the `supabase_realtime` publication —
// see supabase/schema.sql) and calls back with its updated_at, unless it's
// just this device's own write echoing back. Returns an unsubscribe fn.
export function subscribeToRemoteChanges(userId: string, onRemoteChange: (updatedAt: string | null) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`user_data:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_data', filter: `user_id=eq.${userId}` },
      (payload) => {
        const updatedAt = (payload.new as { updated_at?: string } | null)?.updated_at ?? null;
        if (updatedAt && updatedAt === lastPushedUpdatedAt) return;
        onRemoteChange(updatedAt);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
