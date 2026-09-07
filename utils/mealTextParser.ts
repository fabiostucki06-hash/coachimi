import { fuzzyFilterFoodItems } from '@/data/foodDatabase';
import type { FoodItem } from '@/types';

export interface ParsedMealItem {
  rawText: string;
  name: string;
  quantityGrams: number;
  /** Best local match (common-foods DB, recent, or custom foods), if any - the caller falls back to Open Food Facts when this is null. */
  matched: FoodItem | null;
}

// Grams-equivalent per unit. ml/l are treated as ~1g/ml (correct for water-like
// liquids, an approximation for anything denser/lighter) since no per-food
// density table exists here. "Stück"/"EL"/"TL" have no reliable universal gram
// weight, so they fall back to a rough typical-portion estimate.
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gramm: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  stück: 100,
  stk: 100,
  st: 100,
  el: 15,
  tl: 5,
};

const LEADING_QUANTITY = /^(\d+(?:[.,]\d+)?)\s*(g|gramm|kg|ml|l|stück|stk\.?|st\.?|el|tl)?\.?\s+(.+)$/i;
const TRAILING_QUANTITY = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|gramm|kg|ml|l|stück|stk\.?|st\.?|el|tl)?\.?$/i;

/** Splits a free-text meal description into per-food segments: commas, "und"/"mit"/"+"/";" as separators. */
function splitSegments(text: string): string[] {
  return text
    .split(/,|;|\n|(?:\s+(?:und|mit)\s+)|\+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseSegment(segment: string): { name: string; quantityGrams: number } {
  const leading = segment.match(LEADING_QUANTITY);
  if (leading) {
    const amount = Number.parseFloat(leading[1].replace(',', '.'));
    const unit = leading[2]?.toLowerCase().replace(/\.$/, '') ?? 'g';
    const grams = amount * (UNIT_TO_GRAMS[unit] ?? 1);
    return { name: leading[3].trim(), quantityGrams: grams };
  }

  const trailing = segment.match(TRAILING_QUANTITY);
  if (trailing) {
    const amount = Number.parseFloat(trailing[2].replace(',', '.'));
    const unit = trailing[3]?.toLowerCase().replace(/\.$/, '') ?? 'g';
    const grams = amount * (UNIT_TO_GRAMS[unit] ?? 1);
    return { name: trailing[1].trim(), quantityGrams: grams };
  }

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
