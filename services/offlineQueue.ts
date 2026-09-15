import { create } from 'zustand';

/**
 * Matches supabase-js/fetch's network-failure wording - the same heuristic
 * store/syncStore.ts already used locally for its sign-in/sign-up error
 * messages. Centralized here so offline detection (this file) and the
 * write-then-commit retry path (services/diaryActions.ts) agree on what
 * counts as "offline" vs a genuine server/auth error.
 */
export function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network request failed|load failed/i.test(message);
}

interface OfflineQueueState {
  // Best-effort reachability flag, true until proven otherwise. Flips false
  // the moment a push fails with a network error, flips true again once a
  // push actually succeeds or (web only) a browser 'online' event fires.
  // There's no netinfo dependency in this project, so on native this is a
  // proxy driven by real push outcomes rather than a link-layer signal - see
  // services/syncManager.ts.
  online: boolean;
  // Dates that have a diary mutation sitting only in local storage, not yet
  // pushed to Supabase. Cleared in full on the next successful push: every
  // push sends the COMPLETE current snapshot (services/cloudSync.ts), not a
  // per-row insert, so one successful push always clears the whole backlog -
  // there is nothing left to replay item-by-item.
  pendingDates: string[];
  setOnline: (online: boolean) => void;
  markPending: (date: string) => void;
  clearPending: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  online: true,
  pendingDates: [],
  setOnline: (online) => set({ online }),
  markPending: (date) =>
    set((state) => (state.pendingDates.includes(date) ? state : { pendingDates: [...state.pendingDates, date] })),
  clearPending: () => set({ pendingDates: [] }),
}));

export function getPendingCount(): number {
  return useOfflineQueueStore.getState().pendingDates.length;
}
