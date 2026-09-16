import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { DietCycle, DietCycleType, Macros } from '@/types';

interface DietCycleRow {
  id: string;
  name: string;
  type: DietCycleType;
  start_date: string;
  end_date: string;
  target_disabled: boolean;
  target_overrides: Partial<Macros> | null;
}

function mapRow(row: DietCycleRow): DietCycle {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    targetDisabled: row.target_disabled,
    targetOverrides: row.target_overrides ?? null,
  };
}

function toRow(userId: string, cycle: DietCycle): DietCycleRow & { user_id: string } {
  return {
    id: cycle.id,
    user_id: userId,
    name: cycle.name,
    type: cycle.type,
    start_date: cycle.startDate,
    end_date: cycle.endDate,
    target_disabled: cycle.targetDisabled,
    target_overrides: cycle.targetOverrides ?? null,
  };
}

export async function fetchCycles(userId: string): Promise<DietCycle[]> {
  const { data, error } = await supabase
    .from('diet_cycles')
    .select('id, name, type, start_date, end_date, target_disabled, target_overrides')
    .eq('user_id', userId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as DietCycleRow));
}

export async function insertCycle(userId: string, cycle: DietCycle): Promise<void> {
  const { error } = await supabase.from('diet_cycles').insert(toRow(userId, cycle));
  if (error) throw error;
}

export async function updateCycleRemote(userId: string, cycle: DietCycle): Promise<void> {
  const { error } = await supabase
    .from('diet_cycles')
    .update(toRow(userId, cycle))
    .eq('id', cycle.id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteCycleRemote(userId: string, cycleId: string): Promise<void> {
  const { error } = await supabase.from('diet_cycles').delete().eq('id', cycleId).eq('user_id', userId);
  if (error) throw error;
}

/** Listens for another device adding/editing/deleting a cycle for this user - same pattern as services/cloudSync.ts's subscribeToRemoteChanges, one channel per row-event rather than filtering client-side. Returns an unsubscribe fn. */
export function subscribeToCycleChanges(userId: string, onRemoteChange: () => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`diet_cycles:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'diet_cycles', filter: `user_id=eq.${userId}` }, () => onRemoteChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
