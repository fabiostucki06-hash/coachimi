import { supabase } from '@/lib/supabase';
import type { FoodItem, MealType } from '@/types';

export interface MealShare {
  id: string;
  fromUserId: string;
  toUserId: string;
  foodItem: FoodItem;
  mealType: MealType;
  servings: number;
  createdAt: string;
}

interface MealShareRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  food_item: FoodItem;
  meal_type: MealType;
  servings: number;
  created_at: string;
}

function mapMealShare(row: MealShareRow): MealShare {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    foodItem: row.food_item,
    mealType: row.meal_type,
    servings: row.servings,
    createdAt: row.created_at,
  };
}

/**
 * Copies a logged meal straight into a friend's shared-meal inbox
 * (supabase/migrations/0002_meal_shares.sql) so they can add it to their own
 * diary with one tap. RLS only allows this once both are accepted friends -
 * a friend id from outside the caller's friend list is rejected at the DB,
 * not just skipped client-side.
 */
export async function shareMealWithFriend(
  myId: string,
  friendId: string,
  foodItem: FoodItem,
  mealType: MealType,
  servings: number,
): Promise<void> {
  const { error } = await supabase.from('meal_shares').insert({
    from_user_id: myId,
    to_user_id: friendId,
    food_item: foodItem,
    meal_type: mealType,
    servings,
  });
  if (error) throw error;
}

/** Meals shared TO the caller, newest first - the inbox shown on the Freunde screen. */
export async function fetchInboxMealShares(myId: string): Promise<MealShare[]> {
  const { data, error } = await supabase
    .from('meal_shares')
    .select('id, from_user_id, to_user_id, food_item, meal_type, servings, created_at')
    .eq('to_user_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapMealShare(row as MealShareRow));
}

/** Removes a share from the inbox once the recipient has added it to their log or dismissed it - RLS only lets the recipient delete their own inbox rows. */
export async function removeMealShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('meal_shares').delete().eq('id', shareId);
  if (error) throw error;
}
