import { supabase } from '@/lib/supabase';
import type { CloudSnapshot } from '@/services/cloudSync';
import type { BorderId } from '@/types';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
// Lower-case alphanumeric + underscore only - enforced again at the DB level
// (supabase/schema.sql's profiles_username_format check), since Supabase's REST
// API can be hit directly and client-side validation alone wouldn't stop that.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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
  /** Coin Shop "Social Highlight Border" the friend has equipped, shown as a ring around their avatar. */
  activeBorder: BorderId;
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

/** The one place every friends-UI surface (search results, requests, friends list, activity feed) formats a profile for display, so "Name (@handle)" never drifts into slightly different shapes across components. Falls back to just the handle, or the email, if a real name isn't set. */
export function formatFriendLabel(profile: FriendProfile): string {
  const name = profile.name?.trim();
  if (name && profile.username) return `${name} (@${profile.username})`;
  if (profile.username) return `@${profile.username}`;
  return name || profile.email;
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

/** Strips a leading "@", lower-cases, and drops any character outside [a-z0-9_] - applied live as the user types so the field can never even display an invalid handle, not just reject one on save. */
export function normalizeUsernameInput(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

/** Deterministic, always-unique default handle derived from the auth user id (already unique) - assigned at profile-creation time so `username` can be a NOT NULL column with no separate backfill step for brand-new signups. Matches the format the SQL backfill (supabase/schema.sql) uses for profiles that predate this column being required. */
function defaultUsernameFor(userId: string): string {
  return `user_${userId.replace(/-/g, '').slice(0, 10)}`;
}

/**
 * Service-level guard, on top of (not instead of) the DB-level RLS write
 * policies (supabase/migrations/0001_friends_readonly_access.sql), which
 * scope every profiles/user_data write to auth.uid() = id/user_id: catches
 * a caller accidentally passing a friend's id into a write function (e.g. a
 * stale `userId` from a wrong closure) with a clear error instead of a
 * silent RLS-denied no-op. getSession() reads the locally persisted
 * session, so this doesn't add a network round trip.
 */
async function assertIsSelf(targetUserId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== targetUserId) {
    throw new Error('Nicht erlaubt: Schreibzugriff nur auf die eigenen Daten.');
  }
}

/** Creates the caller's public.profiles row on first sign-in if it doesn't exist yet - a no-op (ignoreDuplicates) on every later call, so it's safe to call on every session start. */
export async function ensureProfile(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, username: defaultUsernameFor(userId) }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[friends] ensureProfile', error);
}

/** Live-typing availability check against the unique `username` column, excluding the caller's own current handle. Returns false (not an error) for a syntactically invalid handle - the caller should already be blocking save on format via USERNAME_PATTERN, this is purely "is it taken". */
export async function checkUsernameAvailable(rawUsername: string, excludeUserId: string): Promise<boolean> {
  const username = normalizeUsernameInput(rawUsername);
  if (!USERNAME_PATTERN.test(username)) return false;
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).neq('id', excludeUserId).maybeSingle();
  if (error) throw error;
  return !data;
}

export async function fetchMyProfile(userId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.from('profiles').select('id, email, username, name, is_profile_public').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

/**
 * Upsert, not update: if the caller edits their username before ensureProfile's
 * own (fire-and-forget, best-effort) row-creation upsert has landed - a real
 * race, since that call isn't awaited by anything the UI waits on - a plain
 * UPDATE here would match zero rows and silently no-op. No error, no visible
 * failure, but nothing persisted: the edit only ever existed in profileStore's
 * optimistic local state and vanishes on the next reload/fetchMyProfile. Needs
 * `email` for that same reason - a fresh insert-on-conflict-absent still has to
 * satisfy the NOT NULL column - so callers must always have it on hand
 * (session.user.email), same as ensureProfile does.
 */
export async function updateUsername(userId: string, email: string, rawUsername: string): Promise<void> {
  await assertIsSelf(userId);
  const username = normalizeUsernameInput(rawUsername);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(`Username muss ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} Zeichen lang sein (a-z, 0-9, _).`);
  }
  const { error } = await supabase.from('profiles').upsert({ id: userId, email, username }, { onConflict: 'id' });
  if (error) {
    // Postgres unique_violation - the DB is still the source of truth for
    // uniqueness even though the UI already live-checks via checkUsernameAvailable,
    // since a second device/tab could grab the same handle in the race between them.
    if (error.code === '23505') throw new Error(`@${username} ist bereits vergeben.`);
    throw error;
  }
}

export async function setProfilePublic(userId: string, isPublic: boolean): Promise<void> {
  await assertIsSelf(userId);
  const { error } = await supabase.from('profiles').update({ is_profile_public: isPublic }).eq('id', userId);
  if (error) throw error;
}

/** Searches public profiles by @username (the primary identifier for finding people now - see USERNAME_PATTERN). Accepts a leading "@" or raw text; matches partial/substring, not just an exact handle. */
export async function searchUsers(query: string, myId: string): Promise<FriendProfile[]> {
  const normalized = normalizeUsernameInput(query);
  if (!normalized) return [];
  const pattern = `%${escapeLikePattern(normalized)}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, name, is_profile_public')
    .neq('id', myId)
    .ilike('username', pattern)
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => mapProfile(row as ProfileRow));
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
    activeBorder: snapshot?.rewards?.activeBorder ?? 'none',
  };
}

/** Reads accepted friends' synced snapshots (gated by the `user_data` RLS policy above) and reduces each to today's protein/calories/completed-workouts summary for the activity feed. */
export async function fetchFriendActivity(friendIds: string[], dateKey: string): Promise<FriendActivitySummary[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase.from('user_data').select('user_id, data').in('user_id', friendIds);
  if (error) throw error;
  return (data ?? []).map((row) => summarizeSnapshot(row.user_id as string, row.data as CloudSnapshot, dateKey));
}

/**
 * Full synced snapshot for one friend, for the read-only profile/activity view
 * (FriendProfileModal) - same `user_data` row fetchFriendActivity summarizes,
 * but returned whole so the modal can show a per-meal breakdown and the
 * friend's own goals rather than just today's totals. Gated by the same
 * "Accepted friends can read each other's synced data" RLS policy, so this
 * silently returns null (not a thrown error) for a non-friend or a friend
 * with no synced data yet - RLS makes the row simply not come back, it
 * doesn't error.
 */
export async function fetchFriendSnapshot(friendId: string): Promise<CloudSnapshot | null> {
  const { data, error } = await supabase.from('user_data').select('data').eq('user_id', friendId).maybeSingle();
  if (error) throw error;
  return (data?.data as CloudSnapshot | undefined) ?? null;
}
