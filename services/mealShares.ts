import { supabase } from '@/lib/supabase';
import { sanitizeSharedFoodItem, sanitizeSharedMealType, sanitizeSharedServings, toShareError } from '@/services/sharedMealPayload';
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
  food_item: unknown;
  meal_type: unknown;
  servings: unknown;
  created_at: string;
}

/** null for a row whose payload has no usable food item - it's skipped rather than failing the whole inbox. */
function mapMealShare(row: MealShareRow): MealShare | null {
  const foodItem = sanitizeSharedFoodItem(row.food_item);
  if (!foodItem) return null;
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    foodItem,
    mealType: sanitizeSharedMealType(row.meal_type),
    servings: sanitizeSharedServings(row.servings),
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
  const cleanItem = sanitizeSharedFoodItem(foodItem);
  if (!cleanItem) throw new Error('Dieser Eintrag hat keinen Namen und kann nicht gesendet werden.');

  const { error } = await supabase.from('meal_shares').insert({
    from_user_id: myId,
    to_user_id: friendId,
    food_item: cleanItem,
    meal_type: sanitizeSharedMealType(mealType),
    servings: sanitizeSharedServings(servings),
  });
  if (error) throw toShareError(error);
}

/** Meals shared TO the caller, newest first - the inbox shown on the Freunde screen. */
export async function fetchInboxMealShares(myId: string): Promise<MealShare[]> {
  const { data, error } = await supabase
    .from('meal_shares')
    .select('id, from_user_id, to_user_id, food_item, meal_type, servings, created_at')
    .eq('to_user_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw toShareError(error);
  return (data ?? []).map((row) => mapMealShare(row as MealShareRow)).filter((share): share is MealShare => share !== null);
}

/** Removes a share from the inbox once the recipient has added it to their log or dismissed it - RLS only lets the recipient delete their own inbox rows. */
export async function removeMealShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('meal_shares').delete().eq('id', shareId);
  if (error) throw toShareError(error);
}
