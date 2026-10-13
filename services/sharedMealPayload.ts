import type { FoodItem, FoodItemSource, MealType, Micronutrients } from '@/types';
import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

// A shared meal crosses two trust boundaries: it's written by another user's
// client (possibly an older/newer app version) and stored as untyped jsonb, so
// what comes back out of `meal_shares`/`meal_group_shares` is only a FoodItem
// by convention. Both directions go through the sanitizers below - outgoing so
// a NaN/undefined macro never leaves this device (JSON turns NaN into null),
// incoming so one malformed row can't crash the Freunde screen or put NaN into
// the recipient's diary.

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];
const FOOD_SOURCES: FoodItemSource[] = ['local', 'recent', 'off', 'custom', 'ai', 'community', 'usda', 'fatsecret'];
const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENT_GOALS) as (keyof Micronutrients)[];

function toNonNegative(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An unknown/missing meal slot falls back to Snacks rather than dropping the share. */
export function sanitizeSharedMealType(raw: unknown): MealType {
  return MEAL_TYPES.includes(raw as MealType) ? (raw as MealType) : 'snack';
}

/** Servings must be a positive number - anything else (null, 0, a non-numeric string) reads as one serving. */
export function sanitizeSharedServings(raw: unknown): number {
  const servings = toNonNegative(raw);
  return servings !== undefined && servings > 0 ? servings : 1;
}

/**
 * Rebuilds a FoodItem from an untrusted payload, field by field: missing or
 * non-numeric macros become 0, micronutrients keep only known keys with a
 * usable value (a missing one stays "unknown", same as everywhere else), and
 * anything not part of FoodItem is dropped. Returns null only when there's no
 * name at all - without one there is nothing to show or log.
 */
export function sanitizeSharedFoodItem(raw: unknown): FoodItem | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const macros = isRecord(raw.macrosPerServing) ? raw.macrosPerServing : {};
  const rawMicronutrients = isRecord(raw.micronutrientsPerServing) ? raw.micronutrientsPerServing : {};
  const micronutrients: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const value = toNonNegative(rawMicronutrients[key]);
    if (value !== undefined) micronutrients[key] = value;
  }

  const servingSize = toNonNegative(raw.servingSize);
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `shared-${name}`,
    name,
    ...(brand ? { brand } : {}),
    caloriesPerServing: toNonNegative(raw.caloriesPerServing) ?? 0,
    macrosPerServing: {
      carbs: toNonNegative(macros.carbs) ?? 0,
      protein: toNonNegative(macros.protein) ?? 0,
      fat: toNonNegative(macros.fat) ?? 0,
    },
    micronutrientsPerServing: micronutrients,
    servingSize: servingSize !== undefined && servingSize > 0 ? servingSize : 100,
    servingUnit: typeof raw.servingUnit === 'string' && raw.servingUnit ? raw.servingUnit : 'g',
    ...(FOOD_SOURCES.includes(raw.source as FoodItemSource) ? { source: raw.source as FoodItemSource } : {}),
  };
}

function errorField(err: unknown, field: 'code' | 'message'): string {
  return isRecord(err) && typeof err[field] === 'string' ? (err[field] as string) : '';
}

/** True when the table itself doesn't exist on the backend yet (its migration was never applied) - PostgREST's schema-cache miss, or Postgres's own undefined_table. */
export function isMissingTableError(err: unknown): boolean {
  const code = errorField(err, 'code');
  return code === 'PGRST205' || code === '42P01';
}

/**
 * Supabase rejects with a plain PostgrestError object, not an Error instance -
 * so the screens' `err instanceof Error ? err.message : <generic>` fallback
 * always showed the generic text and hid the actual reason. This turns any
 * share failure into a real Error with a message worth showing.
 */
export function toShareError(err: unknown): Error {
  const code = errorField(err, 'code');
  const message = errorField(err, 'message') || (err instanceof Error ? err.message : '');

  // 42501 = row-level security rejected the insert: no accepted friendship.
  if (code === '42501') return new Error('Senden nicht möglich - ihr seid (noch) keine bestätigten Freunde.');
  // 23503 = the recipient's account no longer exists.
  if (code === '23503') return new Error('Senden nicht möglich - dieses Konto existiert nicht mehr.');
  if (/failed to fetch|network request failed|load failed/i.test(message)) {
    return new Error('Keine Verbindung - bitte später erneut versuchen.');
  }
  return new Error(message || 'Aktion fehlgeschlagen');
}
