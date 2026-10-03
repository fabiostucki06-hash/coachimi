import { supabase } from '@/lib/supabase';
import type { FoodItem, MealType } from '@/types';

export interface MealGroupShareItem {
  foodItem: FoodItem;
  servings: number;
}

export interface MealGroupShare {
  id: string;
  fromUserId: string;
  toUserId: string;
  mealType: MealType;
  items: MealGroupShareItem[];
  createdAt: string;
}

interface MealGroupShareItemRow {
  food_item: FoodItem;
  servings: number;
}

interface MealGroupShareRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  meal_type: MealType;
  items: MealGroupShareItemRow[];
  created_at: string;
}

function mapMealGroupShare(row: MealGroupShareRow): MealGroupShare {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    mealType: row.meal_type,
    items: row.items.map((item) => ({ foodItem: item.food_item, servings: item.servings })),
    createdAt: row.created_at,
  };
}

/**
 * Copies every entry of one logged meal section (e.g. all of Frühstück)
 * straight into a friend's shared-meal-group inbox
 * (supabase/migrations/0012_meal_group_shares.sql), as a single unit, so
 * they can add the whole thing to their own diary with one tap. RLS only
 * allows this once both are accepted friends - a friend id from outside the
 * caller's friend list is rejected at the DB, not just skipped client-side.
 */
export async function shareMealGroupWithFriend(
  myId: string,
  friendId: string,
  mealType: MealType,
  items: MealGroupShareItem[],
): Promise<void> {
  const { error } = await supabase.from('meal_group_shares').insert({
    from_user_id: myId,
    to_user_id: friendId,
    meal_type: mealType,
    items: items.map((item) => ({ food_item: item.foodItem, servings: item.servings })),
  });
  if (error) throw error;
}

/** Meal groups shared TO the caller, newest first - the inbox shown on the Freunde screen, alongside the single-item inbox from services/mealShares.ts. */
export async function fetchInboxMealGroupShares(myId: string): Promise<MealGroupShare[]> {
  const { data, error } = await supabase
    .from('meal_group_shares')
    .select('id, from_user_id, to_user_id, meal_type, items, created_at')
    .eq('to_user_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapMealGroupShare(row as MealGroupShareRow));
}

/** Removes a share from the inbox once the recipient has added it to their log or dismissed it - RLS only lets the recipient delete their own inbox rows. */
export async function removeMealGroupShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('meal_group_shares').delete().eq('id', shareId);
  if (error) throw error;
}
