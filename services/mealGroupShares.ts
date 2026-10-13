import { supabase } from '@/lib/supabase';
import {
  isMissingTableError,
  sanitizeSharedFoodItem,
  sanitizeSharedMealType,
  sanitizeSharedServings,
  toShareError,
} from '@/services/sharedMealPayload';
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

interface MealGroupShareRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  meal_type: unknown;
  items: unknown;
  created_at: string;
}

/** Keeps every item with a usable food item and drops the rest - one broken entry must not cost the recipient the whole meal. */
function sanitizeItems(rawItems: unknown): MealGroupShareItem[] {
  if (!Array.isArray(rawItems)) return [];
  const items: MealGroupShareItem[] = [];
  for (const rawItem of rawItems) {
    if (typeof rawItem !== 'object' || rawItem === null) continue;
    const { food_item: rawFoodItem, servings } = rawItem as { food_item?: unknown; servings?: unknown };
    const foodItem = sanitizeSharedFoodItem(rawFoodItem);
    if (foodItem) items.push({ foodItem, servings: sanitizeSharedServings(servings) });
  }
  return items;
}

/** null for a row with no usable item at all - it's skipped rather than rendered as an empty meal. */
function mapMealGroupShare(row: MealGroupShareRow): MealGroupShare | null {
  const items = sanitizeItems(row.items);
  if (items.length === 0) return null;
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    mealType: sanitizeSharedMealType(row.meal_type),
    items,
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
 *
 * If that table doesn't exist on the backend yet (migration 0012 not applied),
 * the meal still goes out - as one `meal_shares` row per item, which the
 * recipient's inbox has always been able to show. They arrive as individual
 * entries instead of one bundle, but nothing is lost.
 */
export async function shareMealGroupWithFriend(
  myId: string,
  friendId: string,
  mealType: MealType,
  items: MealGroupShareItem[],
): Promise<void> {
  const cleanMealType = sanitizeSharedMealType(mealType);
  const cleanItems = items.flatMap((item) => {
    const foodItem = sanitizeSharedFoodItem(item.foodItem);
    return foodItem ? [{ food_item: foodItem, servings: sanitizeSharedServings(item.servings) }] : [];
  });
  if (cleanItems.length === 0) throw new Error('Diese Mahlzeit enthält keine Einträge, die gesendet werden können.');

  const { error } = await supabase.from('meal_group_shares').insert({
    from_user_id: myId,
    to_user_id: friendId,
    meal_type: cleanMealType,
    items: cleanItems,
  });
  if (!error) return;
  if (!isMissingTableError(error)) throw toShareError(error);

  const { error: fallbackError } = await supabase.from('meal_shares').insert(
    cleanItems.map((item) => ({
      from_user_id: myId,
      to_user_id: friendId,
      food_item: item.food_item,
      meal_type: cleanMealType,
      servings: item.servings,
    })),
  );
  if (fallbackError) throw toShareError(fallbackError);
}

/** Meal groups shared TO the caller, newest first - the inbox shown on the Freunde screen, alongside the single-item inbox from services/mealShares.ts. Empty (not an error) while the table doesn't exist yet - nothing can have been sent into it. */
export async function fetchInboxMealGroupShares(myId: string): Promise<MealGroupShare[]> {
  const { data, error } = await supabase
    .from('meal_group_shares')
    .select('id, from_user_id, to_user_id, meal_type, items, created_at')
    .eq('to_user_id', myId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw toShareError(error);
  }
  return (data ?? []).map((row) => mapMealGroupShare(row as MealGroupShareRow)).filter((share): share is MealGroupShare => share !== null);
}

/** Removes a share from the inbox once the recipient has added it to their log or dismissed it - RLS only lets the recipient delete their own inbox rows. */
export async function removeMealGroupShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('meal_group_shares').delete().eq('id', shareId);
  if (error) throw toShareError(error);
}
