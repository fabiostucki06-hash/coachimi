import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deleteCycleRemote, fetchCycles as fetchCyclesRemote, insertCycle, subscribeToCycleChanges, updateCycleRemote } from '@/services/dietCycles';
import { useSyncStore } from '@/store/syncStore';
import type { DietCycle, DietCycleType, Macros } from '@/types';

/** Real (Math.random-based, not cryptographically strong) UUID v4 - unlike this app's other local ids (`${Date.now()}-${random}`, see store/diaryStore.ts's makeId), a diet cycle's id also has to satisfy Supabase's `uuid` column, so it must be a real UUID from the moment it's created offline - see supabase/migrations/0007_diet_cycles.sql's comment. */
function makeCycleId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface DietCycleInput {
  name: string;
  type: DietCycleType;
  startDate: string;
  endDate: string;
  targetDisabled: boolean;
  targetOverrides?: Partial<Macros> | null;
}

function currentUserId(): string | null {
  return useSyncStore.getState().session?.user.id ?? null;
}

interface CycleState {
  cycles: DietCycle[];
  loading: boolean;
  error: string | null;
  addCycle: (input: DietCycleInput) => void;
  updateCycle: (id: string, changes: Partial<DietCycleInput>) => void;
  removeCycle: (id: string) => void;
  /** Pulls the signed-in user's cycles from Supabase (authoritative for any id it returns) and merges in any local-only cycle not yet synced (e.g. created offline) - re-pushing those so they eventually land remotely too. Call on sign-in and on reconnect/foreground, same as store/coinsStore.ts's fetchCoins. */
  fetchCycles: (userId: string) => Promise<void>;
}

export const useCycleStore = create<CycleState>()(
  persist(
    (set, get) => ({
      cycles: [],
      loading: false,
      error: null,

      addCycle: (input) => {
        const cycle: DietCycle = { id: makeCycleId(), ...input, targetOverrides: input.targetOverrides ?? null };
        set((state) => ({ cycles: [...state.cycles, cycle].sort((a, b) => a.startDate.localeCompare(b.startDate)) }));

        const userId = currentUserId();
        if (userId) {
          insertCycle(userId, cycle).catch((err) => console.error('[cycles] insertCycle', err));
        }
      },

      updateCycle: (id, changes) => {
        let updated: DietCycle | undefined;
        set((state) => ({
          cycles: state.cycles
            .map((cycle) => {
              if (cycle.id !== id) return cycle;
              updated = { ...cycle, ...changes };
              return updated;
            })
            .sort((a, b) => a.startDate.localeCompare(b.startDate)),
        }));

        const userId = currentUserId();
        if (userId && updated) {
          updateCycleRemote(userId, updated).catch((err) => console.error('[cycles] updateCycleRemote', err));
        }
      },

      removeCycle: (id) => {
        set((state) => ({ cycles: state.cycles.filter((cycle) => cycle.id !== id) }));

        const userId = currentUserId();
        if (userId) {
          deleteCycleRemote(userId, id).catch((err) => console.error('[cycles] deleteCycleRemote', err));
        }
      },

      fetchCycles: async (userId) => {
        set({ loading: true, error: null });
        try {
          const remote = await fetchCyclesRemote(userId);
          const remoteIds = new Set(remote.map((cycle) => cycle.id));
          // Cycles created offline before this fetch ever ran - keep them locally
          // and push them up now that a session exists, rather than silently
          // dropping the user's in-progress local planning.
          const localOnly = get().cycles.filter((cycle) => !remoteIds.has(cycle.id));
          for (const cycle of localOnly) {
            insertCycle(userId, cycle).catch((err) => console.error('[cycles] insertCycle (merge)', err));
          }
          const merged = [...remote, ...localOnly].sort((a, b) => a.startDate.localeCompare(b.startDate));
          set({ cycles: merged, loading: false });
        } catch (err) {
          console.error('[cycles] fetchCycles', err);
          set({ loading: false, error: err instanceof Error ? err.message : 'Zyklen konnten nicht geladen werden.' });
        }
      },
    }),
    {
      name: 'coach-imi-cycle-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ cycles: state.cycles }),
    },
  ),
);

// Self-contained cloud hookup: rather than syncStore.ts reaching into this
// store (which would make store/syncStore.ts <-> store/cycleStore.ts a
// circular import), this store watches the session on its own, same data
// syncStore.ts's own listener sees. Fetches once per genuine sign-in
// (session.user.id changing), not on every token-refresh tick, and opens a
// realtime channel for the lifetime of that session so another device's
// change shows up here without waiting for the next app relaunch - see
// services/dietCycles.ts's subscribeToCycleChanges.
let lastSyncedUserId: string | null = null;
let unsubscribeRealtime: (() => void) | null = null;

useSyncStore.subscribe((state) => {
  const userId = state.session?.user.id ?? null;
  if (userId === lastSyncedUserId) return;
  lastSyncedUserId = userId;

  unsubscribeRealtime?.();
  unsubscribeRealtime = null;

  if (userId) {
    void useCycleStore.getState().fetchCycles(userId);
    unsubscribeRealtime = subscribeToCycleChanges(userId, () => {
      void useCycleStore.getState().fetchCycles(userId);
    });
  }
});
