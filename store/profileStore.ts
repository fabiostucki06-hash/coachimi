import { create } from 'zustand';

import type { FriendProfile } from '@/services/friends';

// Not persisted (unlike userStore/diaryStore etc.) - `profiles` in Supabase is
// already this data's source of truth, refetched on every sign-in
// (store/syncStore.ts afterSessionEstablished). This store just holds it in
// memory so every screen that shows the caller's own @username (Profil,
// Freunde) reads the exact same value and updates the instant either one
// saves a change, instead of each screen keeping its own stale local copy.
interface ProfileState {
  profile: FriendProfile | null;
  setProfile: (profile: FriendProfile | null) => void;
  updateProfile: (changes: Partial<FriendProfile>) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  updateProfile: (changes) => set((state) => (state.profile ? { profile: { ...state.profile, ...changes } } : state)),
}));
