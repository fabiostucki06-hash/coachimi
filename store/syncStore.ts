import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import {
  applySnapshot,
  getLocalChangeTimestamp,
  pullSnapshot,
  pushSnapshot,
  recordLocalChange,
  shouldApplyRemote,
  subscribeToRemoteChanges,
} from '@/services/cloudSync';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { useDiaryStore } from '@/store/diaryStore';
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
}

let hasInitialized = false;
let applyingRemote = false;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: (() => void)[] = [];
let lastHandledAccessToken: string | null = null;

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
  recordLocalChange();
  scheduleAutoSync();
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
async function pullAndApply(session: Session): Promise<void> {
  try {
    const remote = await pullSnapshot(session.user.id);
    console.log('[Sync] Remote payload fetched:', remote);
    const localChangedAt = await getLocalChangeTimestamp();
    const shouldApply = remote != null && shouldApplyRemote(remote.updatedAt, localChangedAt);
    if (shouldApply) {
      applyingRemote = true;
      applySnapshot(remote.snapshot);
      applyingRemote = false;
    }
    // No remote row yet, or the remote row is older than an unsynced local
    // edit: leave local STATE untouched rather than overwrite it with stale
    // or placeholder data — see shouldApplyRemote. lastSyncedAt still
    // updates either way: it means "sync last successfully checked in",
    // not "local data last changed", so a no-op check still counts.
    useSyncStore.setState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      remoteUpdatedAt: remote?.updatedAt ?? useSyncStore.getState().remoteUpdatedAt,
      error: null,
    });
  } catch (err) {
    applyingRemote = false;
    useSyncStore.setState({ status: 'error', error: describeSyncError(err) });
  }
}

// Reconnect handler for foreground/focus/online events. A prior push may have
// failed while offline (e.g. a Goldbarren purchase made mid-flight) and left
// status stuck on 'error' with the edit sitting only in local state - retry
// that push first. Otherwise this is just catching up on changes that may
// have landed on another device while this one was away, so pull instead.
function reconnectSync(session: Session) {
  if (useSyncStore.getState().status === 'error') {
    useSyncStore.getState().syncNow();
  } else {
    pullAndApply(session);
  }
}

async function afterSessionEstablished(session: Session) {
  if (session.access_token === lastHandledAccessToken) return;
  lastHandledAccessToken = session.access_token;

  // Pull-then-subscribe, never the other way round: the local stores' persist
  // middleware rehydrates from AsyncStorage asynchronously, on its own timer,
  // independent of this function. If the change-watchers below were armed
  // first, a rehydration landing while the remote fetch was still in flight
  // would fire handleLocalStoreChange and auto-push that (possibly stale,
  // pre-this-session) hydrated state to Supabase before it was ever compared
  // against the remote row - i.e. exactly the "device overwrites remote with
  // stale local state on load" bug. Subscribing only after the initial
  // fetch-and-compare has finished closes that window entirely.
  await pullAndApply(session);
  startAutoSyncWatchers(session);
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
        }
      } else {
        stopAutoSyncWatchers();
        set({ status: 'offline', lastSyncedAt: null, remoteUpdatedAt: null, error: null });
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
    await supabase.auth.signOut();
    set({ status: 'offline', lastSyncedAt: null, remoteUpdatedAt: null, error: null });
  },

  syncNow: async () => {
    const { session } = get();
    if (!session) return;
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
      const remote = await pullSnapshot(session.user.id);
      console.log('[Sync] Remote payload fetched:', remote);
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
}));
