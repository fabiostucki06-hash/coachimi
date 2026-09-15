import { searchFoodHybrid } from '@/services/foodSearch';
import type { DetectedFoodItem } from '@/services/visionFoodApi';
import type { FoodItem, Macros, Micronutrients } from '@/types';
import { calculateScaledNutrients } from '@/utils/nutritionCalculator';

// Below this, a search hit is treated as "probably not the same food" and the
// photo flow falls back to the Vision model's own estimate rather than risk
// silently swapping in a wrong product's numbers.
const MATCH_SCORE_THRESHOLD = 0.55;

// Above this (stricter than MATCH_SCORE_THRESHOLD), a match is trusted enough to
// SILENTLY overwrite the Vision model's full macro/micro estimate rather than just
// being offered as a one-tap "Übernehmen" suggestion - see correctedValuesFromMatch.
export const AUTO_APPLY_MATCH_THRESHOLD = 0.8;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

/**
 * Token-overlap similarity (0-1) between the Vision model's food name and a
 * search candidate's name. Cheap, dependency-free stand-in for a real
 * search-relevance score - good enough here since candidates already come
 * from a name-matching search tier (services/foodSearch.ts), this just picks
 * the best of what it returned and decides whether it's close enough to trust.
 */
export function nameSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap++;
  }
  const jaccard = overlap / (setA.size + setB.size - overlap);
  const normA = normalize(a);
  const normB = normalize(b);
  const substringBonus = normA.length > 2 && (normB.includes(normA) || normA.includes(normB)) ? 0.15 : 0;
  return Math.min(1, jaccard + substringBonus);
}

export interface PhotoMatch {
  status: 'db_verified' | 'ai_estimate';
  candidate: FoodItem | null;
  score: number;
}

/**
 * Cross-checks one Vision-detected food against the local Supabase `foods`
 * table / FatSecret / USDA (searchFoodHybrid's existing 3-tier pipeline -
 * reused rather than duplicated, so this stays consistent with manual search)
 * and returns the best-matching candidate, if any is close enough to trust.
 * Never throws: a search failure (offline, all tiers down) degrades to
 * 'ai_estimate' with no candidate, same as a genuinely low match score - the
 * caller always has the Vision model's own estimate to fall back to.
 */
export async function matchDetectedFood(detected: DetectedFoodItem, signal?: AbortSignal): Promise<PhotoMatch> {
  let results: FoodItem[];
  try {
    results = await searchFoodHybrid(detected.name, signal);
  } catch {
    return { status: 'ai_estimate', candidate: null, score: 0 };
  }
  if (results.length === 0) {
    return { status: 'ai_estimate', candidate: null, score: 0 };
  }

  let best = results[0];
  let bestScore = nameSimilarity(detected.name, best.name);
  for (const candidate of results.slice(1)) {
    const score = nameSimilarity(detected.name, candidate.name);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (bestScore < MATCH_SCORE_THRESHOLD) {
    return { status: 'ai_estimate', candidate: null, score: bestScore };
  }
  return { status: 'db_verified', candidate: best, score: bestScore };
}

/** Runs matchDetectedFood for every detected item in parallel - one Promise.all, not one search tier cascade after another. */
export function matchDetectedFoods(items: DetectedFoodItem[], signal?: AbortSignal): Promise<PhotoMatch[]> {
  return Promise.all(items.map((item) => matchDetectedFood(item, signal)));
}

export interface CorrectedFoodValues {
  caloriesPer100g: number;
  macrosPer100g: Macros;
  micronutrientsPer100g: Required<Micronutrients>;
}

/**
 * Full DB correction (calories + every macro/micro, not just a couple of fields) for
 * one Vision-detected item - but only once the match is confident enough to trust
 * blindly (score >= AUTO_APPLY_MATCH_THRESHOLD, a stricter bar than the one that gets
 * a candidate shown/offered at all). Returns null below that bar, or with no
 * candidate, so the caller's own "keep the Vision estimate" fallback stays the only
 * path there - same never-silently-wrong guarantee as matchDetectedFood itself.
 * Always normalizes the DB candidate to per-100g first (calculateScaledNutrients) so
 * it multiplies cleanly against `estimatedGrams / 100` regardless of the candidate's
 * own servingSize.
 */
export function correctedValuesFromMatch(match: PhotoMatch): CorrectedFoodValues | null {
  if (match.status !== 'db_verified' || !match.candidate || match.score < AUTO_APPLY_MATCH_THRESHOLD) return null;
  const per100 = calculateScaledNutrients(match.candidate, 100);
  return { caloriesPer100g: per100.calories, macrosPer100g: per100.macros, micronutrientsPer100g: per100.micronutrients };
}
