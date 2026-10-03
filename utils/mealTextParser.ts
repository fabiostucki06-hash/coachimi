import { fuzzyFilterFoodItems } from '@/data/foodDatabase';
import type { FoodItem } from '@/types';
import { getPortionWeightForCount } from '@/utils/portionUnits';

export interface ParsedMealItem {
  rawText: string;
  name: string;
  quantityGrams: number;
  /** Best local match (common-foods DB, recent, or custom foods), if any - the caller falls back to Open Food Facts when this is null. */
  matched: FoodItem | null;
}

// Grams-equivalent per unit, for the units that actually have one. ml/l are
// treated as ~1g/ml (correct for water-like liquids, an approximation for
// anything denser/lighter) since no per-food density table exists here.
// "Stück" ("piece") has no universal gram weight at all - it means "one of
// whatever this food is" - so it's handled as a bare count below instead,
// alongside a number with no unit at all ("1 Banane"). EL/TL (Esslöffel/
// Teelöffel - tablespoon/teaspoon) keep a rough generic-volume estimate since
// they're seasoning/liquid units, not "one piece of the food".
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gramm: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  el: 15,
  tl: 5,
};

/** Unit tokens that mean "N pieces", not a weight/volume - routed through getPortionWeightForCount instead of UNIT_TO_GRAMS. */
const PIECE_UNITS = new Set(['stück', 'stk', 'st']);

const LEADING_QUANTITY = /^(\d+(?:[.,]\d+)?)\s*(g|gramm|kg|ml|l|stück|stk\.?|st\.?|el|tl)?\.?\s+(.+)$/i;
const TRAILING_QUANTITY = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|gramm|kg|ml|l|stück|stk\.?|st\.?|el|tl)?\.?$/i;

/** Splits a free-text meal description into per-food segments: commas, "und"/"mit"/"+"/";" as separators. */
function splitSegments(text: string): string[] {
  return text
    .split(/,|;|\n|(?:\s+(?:und|mit)\s+)|\+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Resolves a matched (amount, unit, name) triple into a gram quantity. A bare count - no
 * unit at all ("2 Bananen"), or an explicit "Stück"/"Stk"/"St" - isn't a weight, it's "N of
 * this food", so it goes through getPortionWeightForCount's per-food lookup (banana ~120g,
 * egg ~55g, rice cake ~9g, ...) instead of being misread as grams. That misread used to make
 * "2 Bananen" log as 2g: the unit group only matches real weight/volume tokens, so with none
 * present it was undefined, and the old code defaulted that straight to grams-per-unit 'g'.
 */
function resolveQuantity(rawAmount: string, rawUnit: string | undefined, name: string): { name: string; quantityGrams: number } {
  const amount = Number.parseFloat(rawAmount.replace(',', '.'));
  const unit = rawUnit?.toLowerCase().replace(/\.$/, '');
  const quantityGrams = !unit || PIECE_UNITS.has(unit) ? getPortionWeightForCount(name, amount) : amount * (UNIT_TO_GRAMS[unit] ?? 1);
  return { name, quantityGrams };
}

function parseSegment(segment: string): { name: string; quantityGrams: number } {
  const leading = segment.match(LEADING_QUANTITY);
  if (leading) return resolveQuantity(leading[1], leading[2], leading[3].trim());

  const trailing = segment.match(TRAILING_QUANTITY);
  if (trailing) return resolveQuantity(trailing[2], trailing[3], trailing[1].trim());

  // No quantity found at all - assume a standard 100g portion, editable by the user.
  return { name: segment, quantityGrams: 100 };
}

/** Parses a free-text meal description ("200g Hähnchenbrust mit 150g Reis und 10g Olivenöl") into per-item quantities, matched against local foods first. */
export function parseMealDescription(text: string, localFoodPool: FoodItem[]): ParsedMealItem[] {
  return splitSegments(text).map((rawText) => {
    const { name, quantityGrams } = parseSegment(rawText);
    const matches = fuzzyFilterFoodItems(name, localFoodPool);
    return { rawText, name, quantityGrams, matched: matches[0] ?? null };
  });
}
