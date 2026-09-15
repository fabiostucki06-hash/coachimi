import { supabase } from '@/lib/supabase';
import { translateDeToEn, translateEnToDe } from '@/services/translate';
import type { FoodItem, Macros, Micronutrients } from '@/types';
import { foldFructoseIntoSugar, MICRONUTRIENT_GOALS, percentDvToAmount, withFructoseFoldedIntoSugar } from '@/utils/nutritionCalculator';

const FOODS_TABLE = 'foods';
const MAX_RESULTS = 20;
/** Below this many hits, escalate to the next (slower, further-reaching) tier. */
const MIN_RESULTS_BEFORE_ESCALATE = 3;
const TIER_TIMEOUT_MS = 6000;

const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY?.trim() || 'DEMO_KEY';
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

const FATSECRET_CLIENT_ID = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID?.trim();
const FATSECRET_CLIENT_SECRET = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET?.trim();
const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';
/** How many FatSecret search hits get a follow-up food.get call for real per-100g macros - kept small since each hit costs a second request against FatSecret's rate limit. */
const FATSECRET_DETAIL_LIMIT = 5;

function toNonNegative(value: number | undefined | null): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : 0;
}

async function fetchWithTimeout(url: string, init: RequestInit, signal?: AbortSignal, timeoutMs = TIER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function mergeUniqueById(lists: FoodItem[][]): FoodItem[] {
  const seen = new Set<string>();
  const merged: FoodItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
      if (merged.length >= MAX_RESULTS) return merged;
    }
  }
  return merged;
}

// --- Tier 1: local Supabase `foods` table ---------------------------------------

interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  carbs_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  micronutrients: Micronutrients | null;
  source: 'local' | 'fatsecret' | 'usda';
  external_id: string | null;
}

function rowToFoodItem(row: FoodRow): FoodItem {
  return {
    id: row.external_id ?? row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    caloriesPerServing: toNonNegative(row.calories_per_100g),
    macrosPerServing: {
      carbs: toNonNegative(row.carbs_per_100g),
      protein: toNonNegative(row.protein_per_100g),
      fat: toNonNegative(row.fat_per_100g),
    },
    micronutrientsPerServing: withFructoseFoldedIntoSugar(row.micronutrients),
    servingSize: 100,
    servingUnit: 'g',
    source: row.source === 'local' ? 'local' : row.source,
  };
}

/** Tier 1 - `ILIKE '%term%'` against the trigram-indexed `foods.name` column. Best-effort: any failure (offline, table not migrated yet) just falls through to Tier 2. */
async function searchLocal(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const builder = supabase.from(FOODS_TABLE).select('*').ilike('name', `%${query}%`).limit(MAX_RESULTS);
  const { data, error } = await (signal ? builder.abortSignal(signal) : builder);
  if (error || !data) return [];
  return (data as FoodRow[]).map(rowToFoodItem);
}

// --- Tier 2: FatSecret (DACH brand/barcode coverage) ------------------------------

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Manual base64 encode for the OAuth Basic-Auth header - `btoa` isn't guaranteed to exist on Hermes/React Native, unlike a browser or Node runtime. ASCII-only input (client id/secret), so no UTF-8 handling needed. */
function toBase64(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; i += 3) {
    const byte1 = input.charCodeAt(i);
    const byte2 = input.charCodeAt(i + 1);
    const byte3 = input.charCodeAt(i + 2);
    const chunk = (byte1 << 16) | ((Number.isNaN(byte2) ? 0 : byte2) << 8) | (Number.isNaN(byte3) ? 0 : byte3);

    output += BASE64_CHARS[(chunk >> 18) & 0x3f];
    output += BASE64_CHARS[(chunk >> 12) & 0x3f];
    output += Number.isNaN(byte2) ? '=' : BASE64_CHARS[(chunk >> 6) & 0x3f];
    output += Number.isNaN(byte3) ? '=' : BASE64_CHARS[chunk & 0x3f];
  }
  return output;
}

let fatSecretToken: { value: string; expiresAt: number } | null = null;

/** Client-credentials token, cached in-module until ~1 min before expiry. Returns null (never throws) when FatSecret isn't configured or the token request fails, so callers can just skip Tier 2. */
async function getFatSecretToken(signal?: AbortSignal): Promise<string | null> {
  if (!FATSECRET_CLIENT_ID || !FATSECRET_CLIENT_SECRET) return null;
  if (fatSecretToken && fatSecretToken.expiresAt > Date.now()) return fatSecretToken.value;

  try {
    const basicAuth = toBase64(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`);
    const response = await fetchWithTimeout(
      FATSECRET_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=basic',
      },
      signal,
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    fatSecretToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000 };
    return fatSecretToken.value;
  } catch {
    return null;
  }
}

interface FatSecretSearchFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
}

interface FatSecretSearchResponse {
  foods?: { food?: FatSecretSearchFood | FatSecretSearchFood[] };
}

interface FatSecretServing {
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  carbohydrate?: string;
  protein?: string;
  fat?: string;
  fiber?: string;
  sugar?: string;
  /** Rarely populated by FatSecret, but folded into `sugar` when present - see foldFructoseIntoSugar. */
  fructose?: string;
  saturated_fat?: string;
  sodium?: string;
  potassium?: string;
  /** Reported as %DV (per FatSecret's docs), not an absolute amount - see percentDvToAmount. */
  calcium?: string;
  /** Reported as %DV (per FatSecret's docs), not an absolute amount - see percentDvToAmount. */
  iron?: string;
  /** Reported as %DV (per FatSecret's docs), not an absolute amount - see percentDvToAmount. */
  vitamin_a?: string;
  /** Reported as %DV (per FatSecret's docs), not an absolute amount - see percentDvToAmount. */
  vitamin_c?: string;
}

interface FatSecretGetResponse {
  food?: {
    food_name?: string;
    brand_name?: string;
    servings?: { serving?: FatSecretServing | FatSecretServing[] };
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Scales one FatSecret serving (whatever its metric gram amount is) up/down to per-100g, since FatSecret reports macros per *serving*, not per 100g. Returns null if the serving isn't gram-based (e.g. "1 cup") - there's nothing to scale from. */
function servingToPer100g(serving: FatSecretServing): { macros: Macros; calories: number; micronutrients: Micronutrients } | null {
  const gramAmount = Number.parseFloat(serving.metric_serving_amount ?? '');
  if (serving.metric_serving_unit !== 'g' || !Number.isFinite(gramAmount) || gramAmount <= 0) return null;

  const factor = 100 / gramAmount;
  const num = (value: string | undefined) => (value !== undefined ? Number.parseFloat(value) * factor : undefined);

  return {
    calories: toNonNegative(num(serving.calories)),
    macros: {
      carbs: toNonNegative(num(serving.carbohydrate)),
      protein: toNonNegative(num(serving.protein)),
      fat: toNonNegative(num(serving.fat)),
    },
    micronutrients: {
      fiber: num(serving.fiber),
      sugar: foldFructoseIntoSugar(num(serving.sugar), num(serving.fructose)),
      saturatedFat: num(serving.saturated_fat),
      sodium: num(serving.sodium),
      potassium: num(serving.potassium),
      calcium: percentDvToAmount(num(serving.calcium), MICRONUTRIENT_GOALS.calcium),
      iron: percentDvToAmount(num(serving.iron), MICRONUTRIENT_GOALS.iron),
      vitaminA: percentDvToAmount(num(serving.vitamin_a), MICRONUTRIENT_GOALS.vitaminA),
      vitaminC: percentDvToAmount(num(serving.vitamin_c), MICRONUTRIENT_GOALS.vitaminC),
    },
  };
}

/** Follow-up call per search hit - `foods.search` only returns a one-line description, not structured per-100g macros. Picks the first gram-based serving; best-effort, drops the item entirely if FatSecret has no usable serving. */
async function fetchFatSecretDetail(foodId: string, token: string, signal?: AbortSignal): Promise<FoodItem | null> {
  const url = `${FATSECRET_API_URL}?method=food.get&food_id=${encodeURIComponent(foodId)}&format=json`;
  const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } }, signal);
  if (!response.ok) return null;

  const data = (await response.json()) as FatSecretGetResponse;
  const servings = asArray(data.food?.servings?.serving);
  const gramServing = servings.map(servingToPer100g).find((result) => result !== null);
  if (!gramServing) return null;

  return {
    id: foodId,
    name: data.food?.food_name || 'Unbekanntes Lebensmittel',
    brand: data.food?.brand_name || undefined,
    caloriesPerServing: Math.round(gramServing.calories),
    macrosPerServing: gramServing.macros,
    micronutrientsPerServing: gramServing.micronutrients,
    servingSize: 100,
    servingUnit: 'g',
    source: 'fatsecret',
  };
}

/** Tier 2 - FatSecret's DACH-region brand/barcode catalog. Skipped entirely (returns []) when EXPO_PUBLIC_FATSECRET_CLIENT_ID/SECRET aren't set, so the pipeline degrades to Tier 1 + Tier 3 rather than erroring. */
async function searchFatSecret(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const token = await getFatSecretToken(signal);
  if (!token) return [];

  const searchUrl = `${FATSECRET_API_URL}?method=foods.search&search_expression=${encodeURIComponent(query)}&format=json&max_results=${FATSECRET_DETAIL_LIMIT}`;
  const response = await fetchWithTimeout(searchUrl, { headers: { Authorization: `Bearer ${token}` } }, signal);
  if (!response.ok) return [];

  const data = (await response.json()) as FatSecretSearchResponse;
  const hits = asArray(data.foods?.food).slice(0, FATSECRET_DETAIL_LIMIT);

  const details = await Promise.all(hits.map((hit) => fetchFatSecretDetail(hit.food_id, token, signal).catch(() => null)));
  return details.filter((item): item is FoodItem => item !== null);
}

// --- Tier 3: translated USDA FoodData Central -------------------------------------

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaFood {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

// Same USDA FoodData Central nutrient IDs services/foodApi.ts's own USDA tier uses -
// duplicated here (not imported) since each search tier normalizes its own raw API
// shape independently, same pattern the rest of this file already follows.
const USDA_NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugar: 2000,
  fructose: 1010,
  saturatedFat: 1258,
  sodium: 1093,
  potassium: 1092,
  calcium: 1087,
  iron: 1089,
  magnesium: 1090,
  zinc: 1095,
  vitaminA: 1106,
  vitaminC: 1162,
  vitaminD: 1114,
  vitaminE: 1109,
  vitaminK: 1185,
  vitaminB12: 1178,
} as const;

function findUsdaNutrient(nutrients: UsdaNutrient[], nutrientId: number): number | undefined {
  return nutrients.find((nutrient) => nutrient.nutrientId === nutrientId)?.value;
}

/** USDA Branded/Foundation/SR Legacy nutrients are already reported per 100g, so no scaling is needed here (unlike FatSecret's per-serving values) - only the name needs translating. */
async function normalizeUsdaFood(food: UsdaFood): Promise<FoodItem> {
  const nutrients = food.foodNutrients ?? [];
  const get = (nutrientId: number) => findUsdaNutrient(nutrients, nutrientId);
  const nameDe = await translateEnToDe(food.description || 'Unbekanntes Lebensmittel');

  return {
    id: String(food.fdcId),
    name: nameDe,
    brand: food.brandOwner || undefined,
    caloriesPerServing: Math.round(toNonNegative(get(USDA_NUTRIENT_IDS.calories))),
    macrosPerServing: {
      carbs: toNonNegative(get(USDA_NUTRIENT_IDS.carbs)),
      protein: toNonNegative(get(USDA_NUTRIENT_IDS.protein)),
      fat: toNonNegative(get(USDA_NUTRIENT_IDS.fat)),
    },
    micronutrientsPerServing: {
      fiber: get(USDA_NUTRIENT_IDS.fiber),
      sugar: foldFructoseIntoSugar(get(USDA_NUTRIENT_IDS.sugar), get(USDA_NUTRIENT_IDS.fructose)),
      saturatedFat: get(USDA_NUTRIENT_IDS.saturatedFat),
      sodium: get(USDA_NUTRIENT_IDS.sodium),
      potassium: get(USDA_NUTRIENT_IDS.potassium),
      calcium: get(USDA_NUTRIENT_IDS.calcium),
      iron: get(USDA_NUTRIENT_IDS.iron),
      magnesium: get(USDA_NUTRIENT_IDS.magnesium),
      zinc: get(USDA_NUTRIENT_IDS.zinc),
      vitaminA: get(USDA_NUTRIENT_IDS.vitaminA),
      vitaminC: get(USDA_NUTRIENT_IDS.vitaminC),
      vitaminD: get(USDA_NUTRIENT_IDS.vitaminD),
      vitaminE: get(USDA_NUTRIENT_IDS.vitaminE),
      vitaminK: get(USDA_NUTRIENT_IDS.vitaminK),
      vitaminB12: get(USDA_NUTRIENT_IDS.vitaminB12),
    },
    servingSize: 100,
    servingUnit: 'g',
    source: 'usda',
  };
}

/** Tier 3 - last resort: translate the German query to English, search USDA FoodData Central, translate each hit's name back to German. Only reached once Tier 1 and Tier 2 both came back thin. */
async function searchUsdaTranslated(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const englishQuery = await translateDeToEn(query);
  const url = `${USDA_SEARCH_URL}?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(englishQuery)}&pageSize=${MAX_RESULTS}`;
  const response = await fetchWithTimeout(url, {}, signal);
  if (!response.ok) return [];

  const data = (await response.json()) as UsdaSearchResponse;
  const foods = (data.foods ?? []).filter((food) => (food.foodNutrients ?? []).length > 0);
  return Promise.all(foods.map((food) => normalizeUsdaFood(food)));
}

// --- Auto-caching ------------------------------------------------------------------

/**
 * Persists a Tier 2/Tier 3 pick into the local `foods` table (Tier 1) so the next
 * search for the same item - by any user - resolves instantly instead of hitting
 * FatSecret/USDA again. Fire-and-forget from the caller's perspective: a failure
 * here (offline, RLS not migrated) must never block the user's own food log.
 */
export async function cacheFoodItem(item: FoodItem): Promise<void> {
  if (item.source !== 'fatsecret' && item.source !== 'usda') return;

  try {
    const { error } = await supabase.from(FOODS_TABLE).upsert(
      {
        name: item.name,
        brand: item.brand ?? null,
        calories_per_100g: toNonNegative(item.caloriesPerServing),
        carbs_per_100g: toNonNegative(item.macrosPerServing.carbs),
        protein_per_100g: toNonNegative(item.macrosPerServing.protein),
        fat_per_100g: toNonNegative(item.macrosPerServing.fat),
        micronutrients: item.micronutrientsPerServing,
        source: item.source,
        external_id: item.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source,external_id' },
    );
    if (error) console.error('[foodSearch] Auto-Caching fehlgeschlagen:', error);
  } catch (error) {
    console.error('[foodSearch] Auto-Caching fehlgeschlagen:', error);
  }
}

// --- 3-tier hybrid pipeline ----------------------------------------------------------

/**
 * Tier 1 local `foods` table -> Tier 2 FatSecret (DACH brands/barcodes) -> Tier 3
 * translated USDA FoodData Central, each tier only run if the previous one came back
 * under MIN_RESULTS_BEFORE_ESCALATE hits. Every tier is best-effort: a single tier's
 * failure just falls through to the next instead of failing the whole search.
 */
export async function searchFoodHybrid(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const local = await searchLocal(trimmed, signal).catch(() => [] as FoodItem[]);
  if (local.length >= MIN_RESULTS_BEFORE_ESCALATE) return local;

  const fatSecret = await searchFatSecret(trimmed, signal).catch(() => [] as FoodItem[]);
  let results = mergeUniqueById([local, fatSecret]);
  if (results.length >= MIN_RESULTS_BEFORE_ESCALATE) return results;

  const usda = await searchUsdaTranslated(trimmed, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, usda]);
  return results;
}
