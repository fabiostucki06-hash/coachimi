import { supabase } from '@/lib/supabase';
import type { CloudSnapshot } from '@/services/cloudSync';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendProfile {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  isProfilePublic: boolean;
}

export interface FriendListItem {
  friendshipId: string;
  status: FriendshipStatus;
  /** Whose action the other status transition is waiting on - 'incoming' means the profile owner sent it to me. */
  direction: 'incoming' | 'outgoing';
  profile: FriendProfile;
}

export interface FriendActivitySummary {
  friendId: string;
  proteinG: number;
  proteinGoalG: number;
  calories: number;
  calorieGoal: number;
  completedWorkoutNames: string[];
}

interface ProfileRow {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  is_profile_public: boolean;
}

interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
}

function mapProfile(row: ProfileRow): FriendProfile {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    isProfilePublic: row.is_profile_public,
  };
}

// Escapes PostgREST's ilike wildcard characters so a search term containing
// them (e.g. someone typing "50%_off") is matched literally instead of acting
// as a wildcard - same principle as a SQL LIKE-escape, applied to the pattern
// we build ourselves rather than trusting the raw query string.
function escapeLikePattern(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

/** Creates the caller's public.profiles row on first sign-in if it doesn't exist yet - a no-op (ignoreDuplicates) on every later call, so it's safe to call on every session start. */
export async function ensureProfile(userId: string, email: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[friends] ensureProfile', error);
}

export async function fetchMyProfile(userId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.from('profiles').select('id, email, username, name, is_profile_public').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateUsername(userId: string, username: string): Promise<void> {
  const trimmed = username.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ username: trimmed.length > 0 ? trimmed : null })
    .eq('id', userId);
  if (error) throw error;
}

export async function setProfilePublic(userId: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_profile_public: isPublic }).eq('id', userId);
  if (error) throw error;
}

/** Searches public profiles by exact-ish username/email match, excluding the caller. Two separate queries (rather than a single .or() built from user input) so the search term can never be crafted to inject extra PostgREST filter clauses. */
export async function searchUsers(query: string, myId: string): Promise<FriendProfile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${escapeLikePattern(trimmed)}%`;
  const columns = 'id, email, username, name, is_profile_public';

  const [byUsername, byEmail] = await Promise.all([
    supabase.from('profiles').select(columns).neq('id', myId).ilike('username', pattern).limit(20),
    supabase.from('profiles').select(columns).neq('id', myId).ilike('email', pattern).limit(20),
  ]);
  if (byUsername.error) throw byUsername.error;
  if (byEmail.error) throw byEmail.error;

  const byId = new Map<string, FriendProfile>();
  for (const row of [...(byUsername.data ?? []), ...(byEmail.data ?? [])]) {
    byId.set(row.id, mapProfile(row as ProfileRow));
  }
  return Array.from(byId.values());
}

export async function sendFriendRequest(myId: string, friendId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({ user_id: myId, friend_id: friendId, status: 'pending' });
  if (error) throw error;
}

export async function respondToRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/** All friendships (any status, either direction) involving the caller, joined against `profiles` for the other side. */
export async function fetchFriendships(myId: string): Promise<FriendListItem[]> {
  const { data, error } = await supabase.from('friendships').select('id, user_id, friend_id, status').or(`user_id.eq.${myId},friend_id.eq.${myId}`);
  if (error) throw error;
  const rows = (data ?? []) as FriendshipRow[];
  if (rows.length === 0) return [];

  const otherIds = Array.from(new Set(rows.map((row) => (row.user_id === myId ? row.friend_id : row.user_id))));
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, username, name, is_profile_public')
    .in('id', otherIds);
  if (profileError) throw profileError;
  const profileById = new Map((profileRows ?? []).map((row) => [row.id, mapProfile(row as ProfileRow)]));

  const items: FriendListItem[] = [];
  for (const row of rows) {
    const otherId = row.user_id === myId ? row.friend_id : row.user_id;
    const profile = profileById.get(otherId);
    if (!profile) continue;
    items.push({
      friendshipId: row.id,
      status: row.status,
      direction: row.user_id === myId ? 'outgoing' : 'incoming',
      profile,
    });
  }
  return items;
}

// A session counts as a completed workout once every exercise has at least one
// logged (reps > 0) set - same bar trainingStore.ts's local isSessionCompleted uses.
function summarizeSnapshot(friendId: string, snapshot: CloudSnapshot | null | undefined, dateKey: string): FriendActivitySummary {
  const entries = snapshot?.entriesByDate?.[dateKey] ?? [];
  const proteinG = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);
  const calories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);

  const sessions = snapshot?.training?.sessionsByDate?.[dateKey] ?? [];
  const completedWorkoutNames = sessions
    .filter((session) => session.exercises.length > 0 && session.exercises.every((exercise) => exercise.sets.some((set) => set.reps > 0)))
    .map((session) => session.templateName);

  return {
    friendId,
    proteinG: Math.round(proteinG),
    proteinGoalG: snapshot?.user?.dailyMacroGoal?.protein ?? 0,
    calories: Math.round(calories),
    calorieGoal: snapshot?.user?.dailyCalorieGoal ?? 0,
    completedWorkoutNames,
  };
}

/** Reads accepted friends' synced snapshots (gated by the `user_data` RLS policy above) and reduces each to today's protein/calories/completed-workouts summary for the activity feed. */
export async function fetchFriendActivity(friendIds: string[], dateKey: string): Promise<FriendActivitySummary[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase.from('user_data').select('user_id, data').in('user_id', friendIds);
  if (error) throw error;
  return (data ?? []).map((row) => summarizeSnapshot(row.user_id as string, row.data as CloudSnapshot, dateKey));
}
