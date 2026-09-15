import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

// Single source of truth for the Goldbarren/coin balance: unlike every other
// store in this app, deliberately NOT wrapped in zustand's `persist` -
// caching a balance in AsyncStorage is exactly what let a fresh signup or a
// stale reload show a leftover/wrong number (see supabase/migrations/
// 0004_backend_coins.sql). `coins` starts `null` (not 0) so the UI can tell
// "not fetched yet" apart from "genuinely zero".
interface CoinsState {
  coins: number | null;
  loading: boolean;
  error: string | null;
  /** Pulls the current balance from profiles.coins. Call on sign-in/session load and whenever the app wants a fresh read (reconnect, manual refresh). */
  fetchCoins: (userId: string) => Promise<void>;
  /** Earns coins via the add_coins RPC (atomic, server-side) and adopts its returned balance - never computed locally. */
  addCoins: (amount: number) => Promise<void>;
  /** Spends coins via the spend_coins RPC, which itself rejects an insufficient balance - returns whether the spend went through. */
  spendCoins: (amount: number) => Promise<boolean>;
  /** Clears the balance on sign-out so the next account never briefly shows the previous one's number. */
  reset: () => void;
}

export const useCoinsStore = create<CoinsState>((set) => ({
  coins: null,
  loading: false,
  error: null,

  fetchCoins: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.from('profiles').select('coins').eq('id', userId).maybeSingle();
    if (error) {
      console.error('[coins] fetchCoins', error);
      set({ loading: false, error: error.message });
      return;
    }
    set({ coins: data?.coins ?? 0, loading: false });
  },

  addCoins: async (amount) => {
    if (amount <= 0) return;
    const { data, error } = await supabase.rpc('add_coins', { p_amount: amount });
    if (error) {
      console.error('[coins] addCoins', error);
      set({ error: error.message });
      return;
    }
    set({ coins: data as number, error: null });
  },

  spendCoins: async (amount) => {
    if (amount <= 0) return true;
    const { data, error } = await supabase.rpc('spend_coins', { p_amount: amount });
    if (error) {
      // Not a bug/unexpected error, just an unaffordable purchase - the RPC
      // rejects it server-side (the authoritative check, since the local
      // `coins` value could be stale) rather than trusting a client-side guard.
      if (!error.message?.includes('insufficient_coins')) console.error('[coins] spendCoins', error);
      set({ error: error.message });
      return false;
    }
    set({ coins: data as number, error: null });
    return true;
  },

  reset: () => set({ coins: null, loading: false, error: null }),
}));
