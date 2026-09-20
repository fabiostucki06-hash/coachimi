import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import {
  applySnapshot,
  clearRemoteBaseline,
  getLocalChangeTimestamp,
  hasRemoteBaseline,
  markRemoteBaselineLoaded,
  mergeRemoteDiary,
  pullSnapshot,
  pushSnapshot,
  recordLocalChange,
  shouldApplyRemote,
  subscribeToRemoteChanges,
} from '@/services/cloudSync';
import { ensureProfile, fetchMyProfile } from '@/services/friends';
import { useCoinsStore } from '@/store/coinsStore';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { useDiaryStore } from '@/store/diaryStore';
import { useProfileStore } from '@/store/profileStore';
import { useRewardStore } from '@/store/rewardStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useUserStore } from '@/store/userStore';

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface SyncState {
  session: Session | null;
  sessionChecked: boolean;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  remoteUpdatedAt: string | null;
  init: () => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  pullNow: () => Promise<void>;
  /** Retries the pull/push catch-up for the current session - see reconnectSync. */
  reconnect: () => void;
}

let hasInitialized = false;
let applyingRemote = false;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: (() => void)[] = [];
let lastHandledAccessToken: string | null = null;
let watchersUserId: string | null = null;
let baselineInFlight: Promise<boolean> | null = null;

const HYDRATION_TIMEOUT_MS = 3000;

interface PersistedStore {
  persist: { hasHydrated: () => boolean; onFinishHydration: (listener: () => void) => () => void };
}

// The local stores rehydrate from AsyncStorage/localStorage asynchronously.
// Comparing a remote row against a store that hasn't hydrated yet would treat
// the empty defaults as "local state" - so session restore waits for hydration
// (bounded, so a broken storage backend can't wedge sign-in) before it pulls.
function waitForHydration(store: PersistedStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, HYDRATION_TIMEOUT_MS);
    const unsubscribe = store.persist.onFinishHydration(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

function waitForStoresHydrated(): Promise<unknown> {
  return Promise.all(
    [useUserStore, useDiaryStore, useCustomFoodStore, useRewardStore, useTrainingStore].map((store) => waitForHydration(store)),
  );
}

export function describeSyncError(err: unknown): string {
  console.error('[Sync] Error:', err);
  if (err && typeof err === 'object') {
    const { hint, message, details } = err as { hint?: string; message?: string; details?: string };
    return hint || message || details || 'Sync fehlgeschlagen';
  }
  return 'Sync fehlgeschlagen';
}

function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network request failed|load failed/i.test(message);
}

async function withFriendlyAuthErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    console.error('[auth]', err);
    if (isNetworkError(err)) {
      throw new Error('Verbindung zum Server fehlgeschlagen. Bitte API-Konfiguration überprüfen.');
    }
    throw err;
  }
}

function scheduleAutoSync() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    useSyncStore.getState().syncNow();
  }, 200);
}

function handleLocalStoreChange() {
  // Changes applied by applySnapshot() itself must not be recorded as a
  // "local edit" — otherwise the very next reload would treat the remote
  // data we just pulled as stale and refuse to apply it again.
  if (applyingRemote) return;
  // Always recorded, even before this session has a remote baseline: an edit
  // made while the initial pull is still failing/retrying must not later be
  // mistaken for "older than the remote row" and overwritten by it.
  recordLocalChange();
  // Pushing, however, waits for the baseline - see cloudSync.ts's hasRemoteBaseline.
  // The catch-up pull schedules the push itself once it has merged.
  const session = useSyncStore.getState().session;
  if (session && hasRemoteBaseline(session.user.id)) scheduleAutoSync();
}

// Commits a local store mutation that has ALREADY been pushed to Supabase
// (services/diaryActions.ts's write-then-commit flow) without letting the
// change-watcher above treat it as a new unsynced edit and schedule a second,
// redundant push of the exact same state a moment later. Same suppression
// mechanism applySnapshot() already relies on for applied remote pulls.
export function withSyncSuppressed(mutate: () => void): void {
  applyingRemote = true;
  try {
    mutate();
  } finally {
    applyingRemote = false;
  }
}

function startAutoSyncWatchers(session: Session) {
  stopAutoSyncWatchers();
  watchersUserId = session.user.id;
  unsubscribers = [
    useUserStore.subscribe(handleLocalStoreChange),
    useDiaryStore.subscribe(handleLocalStoreChange),
    useCustomFoodStore.subscribe(handleLocalStoreChange),
    useRewardStore.subscribe(handleLocalStoreChange),
    useTrainingStore.subscribe(handleLocalStoreChange),
  ];

  // Best-effort: a realtime subscribe failure (Realtime not enabled on the
  // table yet, a blocked WebSocket, ...) must never take down sign-in — it
  // used to throw here *before* the pullAndApply below ever ran, silently
  // skipping the actual data load.
  try {
    unsubscribers.push(subscribeToRemoteChanges(session.user.id, () => pullAndApply(session)));
  } catch (err) {
    console.error('[sync] realtime subscribe failed', err);
  }
}

function stopAutoSyncWatchers() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  watchersUserId = null;
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

// Pulls the latest remote snapshot and applies it if newer than the last
// local edit. Shared by the initial sign-in pull, the realtime listener (a
// change lands from another device while this one is open), and the
// app-foreground refresh (this device was backgrounded/asleep and missed
// the realtime event entirely).
// Resolves true when the remote row was read successfully (whether or not it was
// applied) - i.e. this device now has a trustworthy baseline to push against.
async function pullAndApply(session: Session): Promise<boolean> {
  try {
    // Coins are backend-driven (profiles.coins via store/coinsStore.ts), not
    // part of the pulled JSONB snapshot below - refetched here too so every
    // occasion this function runs (initial sign-in, a realtime change from
    // another device, foreground/reconnect) also gets a fresh balance rather
    // than showing whatever this device last knew.
    void useCoinsStore.getState().fetchCoins(session.user.id);
    // Retry any earn whose add_coins RPC didn't confirm yet (e.g. earned while
    // offline) - this is exactly the moment connectivity is known-good again,
    // see store/rewardStore.ts's flushPendingCoinCredits.
    void useRewardStore.getState().flushPendingCoinCredits();

    const remote = await pullSnapshot(session.user.id);
    console.log('[Sync] Remote payload fetched:', remote);
    const localChangedAt = await getLocalChangeTimestamp();
    const shouldApply = remote != null && shouldApplyRemote(remote.updatedAt, localChangedAt);
    // Only now - the remote row was read successfully - may pushes go out.
    markRemoteBaselineLoaded(session.user.id);
    if (remote && shouldApply) {
      applyingRemote = true;
      applySnapshot(remote.snapshot);
      applyingRemote = false;
    } else if (remote) {
      // The remote row is older than an unsynced local edit, so it can't just be
      // applied - but the next push replaces the whole row, so any diary entry
      // it holds that this device lacks (logged on another device) would be
      // destroyed. Fold those in additively, then push the merged result.
      const local = useDiaryStore.getState().entriesByDate;
      const merged = mergeRemoteDiary(local, remote.snapshot.entriesByDate);
      if (merged !== local) {
        applyingRemote = true;
        useDiaryStore.setState({ entriesByDate: merged });
        applyingRemote = false;
      }
      scheduleAutoSync();
    }
    // No remote row yet: leave local STATE untouched rather than overwrite it
    // with placeholder data — see shouldApplyRemote. lastSyncedAt still
    // updates either way: it means "sync last successfully checked in",
    // not "local data last changed", so a no-op check still counts.
    useSyncStore.setState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      remoteUpdatedAt: remote?.updatedAt ?? useSyncStore.getState().remoteUpdatedAt,
      error: null,
    });
    return true;
  } catch (err) {
    applyingRemote = false;
    useSyncStore.setState({ status: 'error', error: describeSyncError(err) });
    return false;
  }
}

// Hard sync for load / session restore / token refresh: wait for the local
// stores to hydrate (so the comparison is against real local state, and a late
// rehydration can't masquerade as a user edit), arm the change watchers, then
// read the remote row. Watchers only RECORD edits until that read succeeds -
// nothing pushes this device's possibly stale state before it has been
// compared against the remote row - and the next reconnect / token-refresh /
// focus event retries here if it failed. De-duplicated so overlapping
// triggers (INITIAL_SESSION + TOKEN_REFRESHED + focus) share one in-flight pull.
function establishBaseline(session: Session): Promise<boolean> {
  if (baselineInFlight) return baselineInFlight;
  baselineInFlight = (async () => {
    try {
      await waitForStoresHydrated();
      if (watchersUserId !== session.user.id) startAutoSyncWatchers(session);
      return await pullAndApply(session);
    } finally {
      baselineInFlight = null;
    }
  })();
  return baselineInFlight;
}

// Reconnect handler for foreground/focus/online events. A prior push may have
// failed while offline (e.g. a Goldbarren purchase made mid-flight) and left
// status stuck on 'error' with the edit sitting only in local state - retry
// that push first. Otherwise this is just catching up on changes that may
// have landed on another device while this one was away, so pull instead.
function reconnectSync(session: Session) {
  // No baseline yet (initial pull failed, e.g. expired JWT / offline at launch):
  // pulling is the only safe move - pushing would overwrite the remote row
  // with data this device never compared against it.
  if (!hasRemoteBaseline(session.user.id)) {
    void establishBaseline(session);
  } else if (useSyncStore.getState().status === 'error') {
    useSyncStore.getState().syncNow();
  } else {
    pullAndApply(session);
  }
}

async function afterSessionEstablished(session: Session) {
  if (session.access_token === lastHandledAccessToken) return;
  lastHandledAccessToken = session.access_token;

  // The local stores' persist middleware rehydrates from AsyncStorage
  // asynchronously, on its own timer. establishBaseline waits for that before
  // arming the change-watchers, and no push can go out until a pull has
  // succeeded (cloudSync.ts's hasRemoteBaseline) - together that closes the
  // "device overwrites remote with stale local state on load" bug, including
  // when the very first pull fails (e.g. expired JWT).
  // Best-effort, same reasoning as the realtime-subscribe guard below: a
  // profile row is only needed for the friends feature, so a failure here
  // (e.g. RLS not yet applied on an older Supabase project) must never block
  // sign-in from completing. Populates the shared profileStore once the row
  // exists so the Profil and Freunde screens both start from the same
  // @username without either having to fetch it themselves.
  if (session.user.email) {
    ensureProfile(session.user.id, session.user.email)
      .then(() => fetchMyProfile(session.user.id))
      .then((profile) => useProfileStore.getState().setProfile(profile))
      .catch((err) => console.error('[friends] ensureProfile failed', err));
  }

  await establishBaseline(session);
}

export const useSyncStore = create<SyncState>((set, get) => ({
  session: null,
  sessionChecked: false,
  status: 'offline',
  error: null,
  lastSyncedAt: null,
  remoteUpdatedAt: null,

  init: () => {
    if (hasInitialized) return;
    hasInitialized = true;

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, sessionChecked: true });
      if (session) {
        // Only pull remote state on a genuine (re-)login, not on token refreshes or
        // user-metadata updates — those fire the same callback but must not overwrite
        // local edits made since the last sync.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          set({ status: 'syncing', error: null });
          afterSessionEstablished(session);
        } else if (event === 'TOKEN_REFRESHED' && !hasRemoteBaseline(session.user.id)) {
          // A refresh normally must not touch local state - but if the initial
          // pull failed (typically because the JWT had expired), the fresh
          // token is exactly what makes a retry succeed, so do it now instead
          // of leaving this device without a baseline until the next focus.
          void establishBaseline(session);
        }
      } else {
        stopAutoSyncWatchers();
        clearRemoteBaseline();
        set({ status: 'offline', lastSyncedAt: null, remoteUpdatedAt: null, error: null });
        useProfileStore.getState().setProfile(null);
        useCoinsStore.getState().reset();
      }
    });

    // supabase-js's token auto-refresh runs on a JS timer, which browsers and
    // iOS throttle/suspend once the tab or PWA is backgrounded — a session
    // can sit with an expired JWT until something restarts the timer. Per
    // Supabase's own guidance, drive it off app foreground/background
    // instead of leaving it always-on: stop it while backgrounded, and on
    // return to foreground restart it *and* re-pull, since a realtime event
    // that fired while this device was asleep would have been missed.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        const { session } = get();
        if (session) reconnectSync(session);
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // AppState/visibilitychange alone misses one desktop case: switching
    // between two already-visible windows (multi-monitor, side-by-side)
    // never hides either tab, so visibilityState stays 'visible' and no
    // 'change' event fires — only a real focus/blur does. Cover that gap
    // explicitly on web, same pattern as hooks/useAutoUpdate.ts.
    if (Platform.OS === 'web') {
      const refetchIfSignedIn = () => {
        const { session } = get();
        if (session) reconnectSync(session);
      };
      window.addEventListener('focus', refetchIfSignedIn);
      // A second, already-open tab in the *same* window never fires focus/blur
      // or AppState's 'change' when you switch back to it — only visibilitychange
      // does. Without this, that tab keeps showing whatever it last loaded.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refetchIfSignedIn();
      });
      // Coming back online after a dropped connection (laptop sleep, wifi
      // hiccup) — the realtime channel and any in-flight pull may have
      // silently failed while offline, so re-pull explicitly once back up.
      window.addEventListener('online', refetchIfSignedIn);
    }
  },

  // Registration proceeds straight into the app without a "confirm your email
  // first" gate - if the Supabase project still has email confirmation enabled,
  // no session comes back here and the auto-sync/auth listener in `init()` simply
  // stays signed-out until the user later logs in with the same credentials.
  signUp: async (email, password) =>
    withFriendlyAuthErrors(async () => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    }),

  signIn: async (email, password) =>
    withFriendlyAuthErrors(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        set({ session: data.session, sessionChecked: true, status: 'syncing', error: null });
        await afterSessionEstablished(data.session);
      }
    }),

  signOut: async () => {
    stopAutoSyncWatchers();
    clearRemoteBaseline();
    await supabase.auth.signOut();
    set({ status: 'offline', lastSyncedAt: null, remoteUpdatedAt: null, error: null });
    useCoinsStore.getState().reset();
  },

  syncNow: async () => {
    const { session } = get();
    if (!session) return;
    // Never push before this session has read the remote row - see cloudSync.ts's
    // hasRemoteBaseline. Catch up first; establishBaseline itself schedules the
    // follow-up push if local edits turn out to be pending.
    if (!hasRemoteBaseline(session.user.id)) {
      await establishBaseline(session);
      return;
    }
    set({ status: 'syncing', error: null });
    try {
      const updatedAt = await pushSnapshot(session.user.id);
      set({ status: 'synced', lastSyncedAt: updatedAt, remoteUpdatedAt: updatedAt, error: null });
    } catch (err) {
      set({ status: 'error', error: describeSyncError(err) });
    }
  },

  // Manual refresh: unlike pullAndApply, this unconditionally overwrites local
  // state with whatever Supabase has right now — the whole point of a button
  // the user presses because they suspect this device is showing stale data.
  pullNow: async () => {
    const { session } = get();
    if (!session) return;
    set({ status: 'syncing', error: null });
    try {
      void useCoinsStore.getState().fetchCoins(session.user.id);
      const remote = await pullSnapshot(session.user.id);
      console.log('[Sync] Remote payload fetched:', remote);
      markRemoteBaselineLoaded(session.user.id);
      if (remote) {
        applyingRemote = true;
        applySnapshot(remote.snapshot);
        applyingRemote = false;
      }
      set({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        remoteUpdatedAt: remote?.updatedAt ?? get().remoteUpdatedAt,
        error: null,
      });
    } catch (err) {
      applyingRemote = false;
      set({ status: 'error', error: describeSyncError(err) });
    }
  },

  reconnect: () => {
    const { session } = get();
    if (session) reconnectSync(session);
  },
}));
