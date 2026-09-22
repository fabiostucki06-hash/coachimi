import { supabase } from '@/lib/supabase';
import type { TemplateExercise, WorkoutTemplate } from '@/types';

export interface WorkoutPlanShare {
  id: string;
  fromUserId: string;
  toUserId: string;
  name: string;
  exercises: Omit<TemplateExercise, 'id'>[];
  createdAt: string;
}

interface WorkoutPlanShareRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  name: string;
  exercises: Omit<TemplateExercise, 'id'>[];
  created_at: string;
}

function mapWorkoutPlanShare(row: WorkoutPlanShareRow): WorkoutPlanShare {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    name: row.name,
    exercises: row.exercises,
    createdAt: row.created_at,
  };
}

/**
 * Copies a workout template straight into a friend's shared-plan inbox
 * (supabase/migrations/0011_workout_plan_shares.sql) so they can add it to
 * their own plan library with one tap. RLS only allows this once both are
 * accepted friends - a friend id from outside the caller's friend list is
 * rejected at the DB, not just skipped client-side.
 */
export async function shareWorkoutPlanWithFriend(myId: string, friendId: string, template: Pick<WorkoutTemplate, 'name' | 'exercises'>): Promise<void> {
  const { error } = await supabase.from('workout_plan_shares').insert({
    from_user_id: myId,
    to_user_id: friendId,
    name: template.name,
    exercises: template.exercises.map(({ name, targetSets, targetRepsMin, targetRepsMax }) => ({ name, targetSets, targetRepsMin, targetRepsMax })),
  });
  if (error) throw error;
}

/** Plans shared TO the caller, newest first - the inbox shown on the Freunde screen. */
export async function fetchInboxWorkoutPlanShares(myId: string): Promise<WorkoutPlanShare[]> {
  const { data, error } = await supabase
    .from('workout_plan_shares')
    .select('id, from_user_id, to_user_id, name, exercises, created_at')
    .eq('to_user_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapWorkoutPlanShare(row as WorkoutPlanShareRow));
}

/** Removes a share from the inbox once the recipient has added it to their plans or dismissed it - RLS only lets the recipient delete their own inbox rows. */
export async function removeWorkoutPlanShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('workout_plan_shares').delete().eq('id', shareId);
  if (error) throw error;
}
