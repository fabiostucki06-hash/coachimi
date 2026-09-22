import { supabase } from '@/lib/supabase';
import { getCachedBarcode, setCachedBarcode } from '@/services/barcodeCache';
import type { FoodItem, Micronutrients } from '@/types';
import { foldFructoseIntoSugar, withFructoseFoldedIntoSugar } from '@/utils/nutritionCalculator';

const SEARCH_URL = 'https://de.openfoodfacts.org/cgi/search.pl';
const SEARCH_URL_WORLD = 'https://world.openfoodfacts.org/cgi/search.pl';
// Open Food Facts' newer "Search-a-licious" API - faster and more reliable than the
// legacy Perl cgi/search.pl tiers below, and (unlike them) supports filtering by
// `countries_tags` so a Migros/Coop/Denner product actually surfaces for Swiss users
// instead of being drowned out by German search results.
const SEARCH_URL_SALICIOUS = 'https://search.openfoodfacts.org/search';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 8000;

// Tier 3 barcode backup, only ever consulted once Open Food Facts has nothing for a
// scanned code. USDA's public DEMO_KEY works out of the box (rate-limited); set
// EXPO_PUBLIC_USDA_API_KEY for a real key in production.
const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY?.trim() || 'DEMO_KEY';
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const COMMUNITY_BARCODE_TABLE = 'community_barcodes';
// Open Food Facts blocks or throttles requests that don't identify themselves - a
// generic/default fetch User-Agent reads as bot traffic and can get silently
// rate-limited, which is exactly what makes even well-known products (Coca-Cola
// etc.) intermittently fail to resolve. See https://openfoodfacts.github.io/openfoodfacts-server/api/#requests
const OFF_USER_AGENT = 'CoachImi/1.0.0 (Expo React Native app)';
/** Background search fallback gets a tighter budget so typing never feels blocked by a slow network. */
const SEARCH_TIMEOUT_MS = 2500;
/** Below this many hits, escalate to the next broader search tier instead of settling for a thin result set. */
const MIN_RESULTS_BEFORE_FALLBACK = 3;
const MAX_RESULTS = 20;

function toNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : 0;
}

export class FoodApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FoodApiError';
  }
}

export class ProductNotFoundError extends FoodApiError {
  constructor(identifier: string) {
    super(`Produkt nicht gefunden: ${identifier}`);
    this.name = 'ProductNotFoundError';
  }
}

/** The online search timed out or the device is offline - callers should fall back to local results. */
export class FoodApiUnavailableError extends FoodApiError {
  constructor(cause?: unknown) {
    super('Online-Suche nicht erreichbar. Zeige lokale Treffer.', cause);
    this.name = 'FoodApiUnavailableError';
  }
}

interface OffNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  /** Rarely populated by Open Food Facts - folds into `sugars_100g` if that's missing (see foldFructoseIntoSugar), and is kept standalone as `fructose` regardless. */
  fructose_100g?: number;
  'saturated-fat_100g'?: number;
  'monounsaturated-fat_100g'?: number;
  'polyunsaturated-fat_100g'?: number;
  cholesterol_100g?: number;
  sodium_100g?: number;
  potassium_100g?: number;
  calcium_100g?: number;
  iron_100g?: number;
  magnesium_100g?: number;
  zinc_100g?: number;
  copper_100g?: number;
  manganese_100g?: number;
  selenium_100g?: number;
  iodine_100g?: number;
  'vitamin-a_100g'?: number;
  'vitamin-b1_100g'?: number;
  'vitamin-b2_100g'?: number;
  'vitamin-pp_100g'?: number;
  'pantothenic-acid_100g'?: number;
  'vitamin-b6_100g'?: number;
  biotin_100g?: number;
  'vitamin-b9_100g'?: number;
  'vitamin-b12_100g'?: number;
  'vitamin-c_100g'?: number;
  'vitamin-d_100g'?: number;
  'vitamin-e_100g'?: number;
  'vitamin-k_100g'?: number;
}

// Open Food Facts reports every `_100g` nutrient in grams, regardless of the
// unit it's conventionally displayed in - convert to mg/µg for the ones we
// track in those units. Undefined stays undefined (field simply not reported).
function gramsTo(factor: number, value: number | undefined): number | undefined {
  return value === undefined ? undefined : value * factor;
}
const gramsToMg = (value: number | undefined) => gramsTo(1000, value);
const gramsToMcg = (value: number | undefined) => gramsTo(1_000_000, value);

function sumOptional(...values: (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length > 0 ? present.reduce((sum, value) => sum + value, 0) : undefined;
}

interface OffProduct {
  code?: string;
  id?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  nutriments?: OffNutriments;
}

interface OffSearchResponse {
  products?: OffProduct[];
}

/** A hit from the Search-a-licious API - same `nutriments` shape as the legacy search, but top-level `hits` instead of `products`, and `brands` as a string array instead of a comma-joined string. */
interface SalaciousHit {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string[];
  nutriments?: OffNutriments;
}

interface SalaciousResponse {
  hits?: SalaciousHit[];
}

interface OffProductResponse {
  status: number;
  product?: OffProduct;
}

/** True if the product reports at least one real macro value - guards against OFF entries that are name-only stubs. */
function hasAnyMacro(nutriments: OffNutriments): boolean {
  return (
    nutriments['energy-kcal_100g'] !== undefined ||
    nutriments['energy-kcal'] !== undefined ||
    nutriments.carbohydrates_100g !== undefined ||
    nutriments.proteins_100g !== undefined ||
    nutriments.fat_100g !== undefined
  );
}

function normalizeFoodItem(product: OffProduct, fallbackId: string): FoodItem {
  const nutriments = product.nutriments ?? {};
  const calories = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;

  return {
    id: product.code ?? product.id ?? fallbackId,
    name: product.product_name_de || product.product_name || 'Unbekanntes Lebensmittel',
    brand: product.brands || undefined,
    caloriesPerServing: Math.round(calories),
    macrosPerServing: {
      carbs: nutriments.carbohydrates_100g || 0,
      protein: nutriments.proteins_100g || 0,
      fat: nutriments.fat_100g || 0,
    },
    micronutrientsPerServing: {
      fiber: nutriments.fiber_100g || 0,
      sugar: foldFructoseIntoSugar(nutriments.sugars_100g, nutriments.fructose_100g) ?? 0,
      fructose: nutriments.fructose_100g,
      saturatedFat: nutriments['saturated-fat_100g'],
      unsaturatedFat: sumOptional(nutriments['monounsaturated-fat_100g'], nutriments['polyunsaturated-fat_100g']),
      cholesterol: gramsToMg(nutriments.cholesterol_100g),
      sodium: (nutriments.sodium_100g ?? 0) * 1000,
      potassium: gramsToMg(nutriments.potassium_100g),
      calcium: gramsToMg(nutriments.calcium_100g),
      iron: gramsToMg(nutriments.iron_100g),
      magnesium: gramsToMg(nutriments.magnesium_100g),
      zinc: gramsToMg(nutriments.zinc_100g),
      copper: gramsToMg(nutriments.copper_100g),
      manganese: gramsToMg(nutriments.manganese_100g),
      selenium: gramsToMcg(nutriments.selenium_100g),
      iodine: gramsToMcg(nutriments.iodine_100g),
      vitaminA: gramsToMcg(nutriments['vitamin-a_100g']),
      vitaminB1: gramsToMg(nutriments['vitamin-b1_100g']),
      vitaminB2: gramsToMg(nutriments['vitamin-b2_100g']),
      vitaminB3: gramsToMg(nutriments['vitamin-pp_100g']),
      vitaminB5: gramsToMg(nutriments['pantothenic-acid_100g']),
      vitaminB6: gramsToMg(nutriments['vitamin-b6_100g']),
      vitaminB7: gramsToMcg(nutriments.biotin_100g),
      vitaminB9: gramsToMcg(nutriments['vitamin-b9_100g']),
      vitaminB12: gramsToMcg(nutriments['vitamin-b12_100g']),
      vitaminC: (nutriments['vitamin-c_100g'] ?? 0) * 1000,
      vitaminD: gramsToMcg(nutriments['vitamin-d_100g']),
      vitaminE: gramsToMg(nutriments['vitamin-e_100g']),
      vitaminK: gramsToMcg(nutriments['vitamin-k_100g']),
    },
    servingSize: 100,
    servingUnit: 'g',
  };
}

async function fetchJson<T>(
  url: string,
  externalSignal?: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  headers?: Record<string, string>,
): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  externalSignal?.addEventListener('abort', () => timeoutController.abort());

  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutController.signal, headers });
  } catch (error) {
    if (timeoutController.signal.aborted && !externalSignal?.aborted) {
      throw new FoodApiUnavailableError(error);
    }
    throw new FoodApiError('Netzwerkfehler: Open Food Facts konnte nicht erreicht werden.', error);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new FoodApiError(`Open Food Facts antwortete mit Status ${response.status}.`);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new FoodApiError('Antwort von Open Food Facts konnte nicht gelesen werden.', error);
  }
}

/** True for a bare 8-14 digit string (EAN-8/13, UPC-A/E, GTIN-14) - lets a scanned or pasted barcode typed straight into the search bar skip text search entirely. */
export function looksLikeBarcode(query: string): boolean {
  return /^\d{8,14}$/.test(query.trim());
}

/** Strips punctuation/symbols a user might paste alongside a brand name (quotes, bullets, stray commas) while keeping letters, digits, spaces and hyphens, and collapses runs of whitespace - so "Alpro „Barista“  Hafer!!" still reaches Open Food Facts as clean search terms. */
function sanitizeQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runSearchTier(url: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const data = await fetchJson<OffSearchResponse>(url, signal, SEARCH_TIMEOUT_MS, { 'User-Agent': OFF_USER_AGENT });
  if (__DEV__) console.log('OFF Raw API Response:', url, data);
  const products = data.products ?? [];

  return products
    .filter((product) => (product.product_name || product.product_name_de) && hasAnyMacro(product.nutriments ?? {}))
    .map((product, index) => ({ ...normalizeFoodItem(product, `search-${index}`), source: 'off' as const }));
}

// Major Swiss retailer own-brands (Search-a-licious `brands_tags` slugs) - a Migros/
// Coop/Denner/Volg/Aldi/Lidl shopper logging own-brand groceries hits these
// constantly, so a hit on one of them is boosted ahead of the generic
// country-only tier below. Denner was named in this comment but missing from
// the actual list - it's Switzerland's largest discounter, so that silently
// dropped a huge share of own-brand hits to the slower generic tier.
const SWISS_RETAILER_BRAND_TAGS = ['migros', 'coop', 'm-budget', 'prix-garantie', 'alnatura', 'denner', 'volg', 'aldi-suisse', 'lidl-schweiz', 'spar'];

/**
 * Builds the Search-a-licious `q` param restricting to Swiss-market products, and -
 * when `retailerOnly` is set - further restricted to the major Swiss retailer
 * own-brands above. Field-qualified filters (`countries_tags:"en:switzerland"`) must
 * be embedded in `q` itself: passing `countries_tags` as a *separate* query-string
 * param (the previous approach here) is silently ignored by the API - verified
 * against the live endpoint, not just its docs - so it never actually filtered by
 * country. Quoting the tag value is required too: without quotes, the colon inside
 * "en:switzerland" breaks the field:value parse and the filter matches nothing.
 */
export function buildSwissQuery(term: string, retailerOnly: boolean): string {
  const base = `${term} AND countries_tags:"en:switzerland"`;
  if (!retailerOnly) return base;
  const brandFilter = SWISS_RETAILER_BRAND_TAGS.map((tag) => `brands_tags:${tag}`).join(' OR ');
  return `${base} AND (${brandFilter})`;
}

/** Swiss-market tier via Search-a-licious - same field mapping as `normalizeFoodItem`, just adapted for `hits`/array-brands instead of `products`/string-brands. Exported so services/staplePrefetch.ts can reuse it directly rather than duplicating the query/normalization logic. */
export async function runSwissSearchTier(query: string, signal?: AbortSignal, retailerOnly = false): Promise<FoodItem[]> {
  const url = `${SEARCH_URL_SALICIOUS}?q=${encodeURIComponent(buildSwissQuery(query, retailerOnly))}&langs=de&page_size=${MAX_RESULTS}`;
  const data = await fetchJson<SalaciousResponse>(url, signal, SEARCH_TIMEOUT_MS, { 'User-Agent': OFF_USER_AGENT });
  const hits = data.hits ?? [];

  return hits
    .filter((hit) => (hit.product_name || hit.product_name_de) && hasAnyMacro(hit.nutriments ?? {}))
    .map((hit, index) => ({
      ...normalizeFoodItem({ code: hit.code, product_name: hit.product_name, product_name_de: hit.product_name_de, brands: hit.brands?.join(', '), nutriments: hit.nutriments }, `ch-${index}`),
      source: 'off' as const,
    }));
}

/** Fire-and-forget: persists every barcode-identified hit (OFF/community results, whose `id` is the real EAN/UPC) into the offline barcode cache, so scanning that same product later - even with no connectivity - resolves instantly instead of re-hitting this search pipeline. */
function cacheBarcodedResults(items: FoodItem[]): void {
  for (const item of items) {
    if (looksLikeBarcode(item.id)) setCachedBarcode(item.id, item).catch(() => {});
  }
}

/** Concatenates result lists, keeping first occurrence by id - later (broader) tiers only fill in gaps the earlier ones missed. */
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

/**
 * Cascading search: a bare barcode goes straight to product lookup (its own Tier
 * 1/2/3 cascade, see getFoodByBarcode); otherwise - Tier 1 Supabase community cache
 * by name, additive and best-effort; Tier 2 up to four progressively broader Open
 * Food Facts tiers, stopping as soon as one has enough hits - (a) Swiss-market search
 * via Search-a-licious, for Migros/Coop/Denner products the tiers below rarely
 * surface; (b) DE-hosted legacy mirror, exact terms, fastest and best match quality
 * for German products; (c) global product base scoped to German locale/country tags,
 * for regional brands the DE mirror hasn't synced yet; (d) global, no country
 * restriction, last resort for imported/obscure products; Tier 3 USDA FoodData
 * Central, only once Tier 1 and every OFF tier came back completely empty. No AI
 * fallback by design. Every OFF tier is best-effort: a failure there just means we
 * keep whatever the earlier tier(s) already found instead of failing the whole search.
 */
export async function searchFood(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  if (looksLikeBarcode(trimmedQuery)) {
    try {
      return [await getFoodByBarcode(trimmedQuery, signal)];
    } catch (error) {
      if (error instanceof ProductNotFoundError) return [];
      throw error;
    }
  }

  const cleanQuery = sanitizeQuery(trimmedQuery);
  if (!cleanQuery) return [];
  const encoded = encodeURIComponent(cleanQuery);

  // Tier 1: Supabase community cache, matched by name - other users' contributed
  // products. Additive and best-effort: a failure here never blocks Tier 2, it just
  // means this run relies on Open Food Facts alone, same as before this tier existed.
  const communityResults = await searchCommunityFoods(cleanQuery, signal).catch(() => [] as FoodItem[]);
  if (communityResults.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    cacheBarcodedResults(communityResults);
    return communityResults;
  }

  // Tier 2a: Swiss-market search (Search-a-licious) - tried first since this app's
  // users are primarily in Switzerland, where the DE-hosted legacy mirror below
  // under-indexes local retailers. Retailer-boosted sub-tier first (Migros/Coop/
  // M-Budget/Prix Garantie/Alnatura own-brands, which dominate a Swiss grocery
  // trip) then the plain country-wide tier to fill in anything else Swiss.
  const swissRetailer = await runSwissSearchTier(cleanQuery, signal, true).catch(() => [] as FoodItem[]);
  let results = mergeUniqueById([communityResults, swissRetailer]);
  if (results.length < MIN_RESULTS_BEFORE_FALLBACK) {
    const swiss = await runSwissSearchTier(cleanQuery, signal).catch(() => [] as FoodItem[]);
    results = mergeUniqueById([results, swiss]);
  }
  if (results.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    cacheBarcodedResults(results);
    return results;
  }

  // Tier 2b: Open Food Facts legacy search (DE-hosted mirror).
  const primaryUrl = `${SEARCH_URL}?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${MAX_RESULTS}`;
  const primary = await runSearchTier(primaryUrl, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, primary]);
  if (results.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    cacheBarcodedResults(results);
    return results;
  }

  const secondaryUrl = `${SEARCH_URL_WORLD}?search_terms=${encoded}&search_simple=1&action=process&json=1&lc=de&cc=de&page_size=${MAX_RESULTS}`;
  const secondary = await runSearchTier(secondaryUrl, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, secondary]);
  if (results.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    cacheBarcodedResults(results);
    return results;
  }

  const tertiaryUrl = `${SEARCH_URL_WORLD}?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${MAX_RESULTS}`;
  const tertiary = await runSearchTier(tertiaryUrl, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, tertiary]);
  if (results.length > 0) {
    cacheBarcodedResults(results);
    return results;
  }

  // Tier 3: USDA FoodData Central backup - only reached once Supabase and every OFF
  // tier came back completely empty. No AI fallback by design: an AI guess at a
  // specific product's nutrition facts would be worse than admitting nothing was found.
  return await searchUsda(cleanQuery, signal).catch(() => [] as FoodItem[]);
}

// --- Tier 1: Supabase community cache -----------------------------------------

interface CommunityBarcodeRow {
  barcode: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  carbs_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  micronutrients: Micronutrients | null;
}

function communityRowToFoodItem(row: CommunityBarcodeRow): FoodItem {
  return {
    id: row.barcode,
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
    source: 'community',
  };
}

/** Instant-cache lookup - best-effort: any Supabase error (offline, RLS, table not migrated yet) just falls through to Tier 2 rather than failing the whole scan. */
async function fetchCommunityBarcode(barcode: string): Promise<FoodItem | null> {
  const { data, error } = await supabase.from(COMMUNITY_BARCODE_TABLE).select('*').eq('barcode', barcode).maybeSingle();
  if (error || !data) return null;
  return communityRowToFoodItem(data as CommunityBarcodeRow);
}

/** Tier 1 text search - matches community-contributed products by name (case-insensitive substring), same table as the barcode cache. Best-effort, same as fetchCommunityBarcode. */
async function searchCommunityFoods(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const builder = supabase.from(COMMUNITY_BARCODE_TABLE).select('*').ilike('name', `%${query}%`).limit(MAX_RESULTS);
  const { data, error } = await (signal ? builder.abortSignal(signal) : builder);
  if (error || !data) return [];
  return (data as CommunityBarcodeRow[]).map(communityRowToFoodItem);
}

/**
 * Community Contribution Engine: upserts a manually-entered product into the shared
 * barcode cache so every future scan of the same code - by any user - resolves
 * instantly from Tier 1 instead of hitting Open Food Facts / USDA again. Fire-and-
 * forget from the caller's perspective: a failure here (offline, RLS not migrated)
 * must never block the user's own local save of the product they just created.
 */
export async function upsertCommunityBarcode(
  barcode: string,
  item: Pick<FoodItem, 'name' | 'brand' | 'caloriesPerServing' | 'macrosPerServing' | 'micronutrientsPerServing'>,
): Promise<void> {
  const trimmedBarcode = barcode.trim();
  if (!trimmedBarcode) return;

  try {
    const { error } = await supabase.from(COMMUNITY_BARCODE_TABLE).upsert(
      {
        barcode: trimmedBarcode,
        name: item.name,
        brand: item.brand ?? null,
        calories_per_100g: toNonNegative(item.caloriesPerServing),
        carbs_per_100g: toNonNegative(item.macrosPerServing.carbs),
        protein_per_100g: toNonNegative(item.macrosPerServing.protein),
        fat_per_100g: toNonNegative(item.macrosPerServing.fat),
        micronutrients: item.micronutrientsPerServing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'barcode' },
    );
    if (error) console.error('[foodApi] Community-Barcode-Upsert fehlgeschlagen:', error);
  } catch (error) {
    console.error('[foodApi] Community-Barcode-Upsert fehlgeschlagen:', error);
  }
}

// --- Tier 2: Open Food Facts ----------------------------------------------------

/** Returns null on a clean 404 (product not in OFF) so the caller can fall through to Tier 3 - only a genuine network/parse failure throws. */
async function fetchFromOff(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json`;
  const data = await fetchJson<OffProductResponse>(url, signal, REQUEST_TIMEOUT_MS, { 'User-Agent': OFF_USER_AGENT });
  if (data.status !== 1 || !data.product) return null;
  return { ...normalizeFoodItem(data.product, barcode), source: 'off' };
}

// --- Tier 3: USDA FoodData Central backup ----------------------------------------

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaFood {
  gtinUpc?: string;
  description?: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

// USDA FoodData Central nutrient IDs (stable across the API) - values for Branded
// foods are already reported per 100g, in the same units this app tracks (g for
// macros/fiber/sugar, mg for minerals and most B-vitamins, µg for A/D/B7/B9/B12/K).
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

/** Strips leading zeros so a 12-digit UPC-A and its 13/14-digit GTIN padding compare equal. */
function normalizeBarcodeForCompare(code: string): string {
  return code.replace(/^0+/, '');
}

function normalizeUsdaFood(food: UsdaFood, fallbackId: string): FoodItem {
  const nutrients = food.foodNutrients ?? [];
  const get = (nutrientId: number) => findUsdaNutrient(nutrients, nutrientId);

  return {
    id: food.gtinUpc || fallbackId,
    name: food.description || 'Unbekanntes Lebensmittel',
    brand: food.brandOwner || undefined,
    caloriesPerServing: Math.round(toNonNegative(get(USDA_NUTRIENT_IDS.calories))),
    macrosPerServing: {
      carbs: toNonNegative(get(USDA_NUTRIENT_IDS.carbs)),
      protein: toNonNegative(get(USDA_NUTRIENT_IDS.protein)),
      fat: toNonNegative(get(USDA_NUTRIENT_IDS.fat)),
    },
    micronutrientsPerServing: {
      fiber: toNonNegative(get(USDA_NUTRIENT_IDS.fiber)),
      sugar: toNonNegative(foldFructoseIntoSugar(get(USDA_NUTRIENT_IDS.sugar), get(USDA_NUTRIENT_IDS.fructose))),
      fructose: get(USDA_NUTRIENT_IDS.fructose),
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

/** Searches USDA's Branded Foods dataset for an exact GTIN/UPC match - a text-search hit whose barcode doesn't match the scanned one is treated as no result, never a fuzzy guess. */
async function fetchFromUsda(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
  const url = `${USDA_SEARCH_URL}?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=5`;
  const data = await fetchJson<UsdaSearchResponse>(url, signal);
  const target = normalizeBarcodeForCompare(barcode);
  const match = (data.foods ?? []).find((food) => food.gtinUpc && normalizeBarcodeForCompare(food.gtinUpc) === target);
  return match ? normalizeUsdaFood(match, barcode) : null;
}

/** Tier 3 text search - across every USDA dataset (Branded, Foundation, SR Legacy, Survey), not just Branded, to maximize coverage for generic/staple foods OFF rarely has. */
async function searchUsda(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const url = `${USDA_SEARCH_URL}?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(query)}&pageSize=${MAX_RESULTS}`;
  const data = await fetchJson<UsdaSearchResponse>(url, signal, SEARCH_TIMEOUT_MS);
  return (data.foods ?? [])
    .filter((food) => (food.foodNutrients ?? []).length > 0)
    .map((food, index) => normalizeUsdaFood(food, `usda-${index}`));
}

// --- Multi-tier hierarchy ---------------------------------------------------------

/**
 * Cascading barcode lookup - Tier 0 on-device offline cache (instant, no network at
 * all - a previously scanned product or a prefetched Swiss staple, see
 * services/barcodeCache.ts and services/staplePrefetch.ts), Tier 1 Supabase community
 * cache (instant, populated by other users' manual entries), Tier 2 Open Food Facts
 * (the global product DB), Tier 3 USDA FoodData Central (US-focused backup for
 * products OFF hasn't indexed). No AI fallback here by design: an AI guess at a
 * barcode's exact nutrition facts would be worse than admitting the product isn't
 * found. Every tier past Tier 0 is best-effort - a single tier's failure just falls
 * through to the next, so a scan only ever ends in a real product or a clean "not
 * found" (never a raw network error).
 */
export async function getFoodByBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem> {
  const trimmedBarcode = barcode.trim();
  if (!trimmedBarcode) {
    throw new FoodApiError('Barcode darf nicht leer sein.');
  }

  const offlineMatch = await getCachedBarcode(trimmedBarcode).catch(() => null);
  if (offlineMatch) return offlineMatch;

  const communityMatch = await fetchCommunityBarcode(trimmedBarcode).catch(() => null);
  if (communityMatch) {
    setCachedBarcode(trimmedBarcode, communityMatch).catch(() => {});
    return communityMatch;
  }

  const offMatch = await fetchFromOff(trimmedBarcode, signal).catch(() => null);
  if (offMatch) {
    setCachedBarcode(trimmedBarcode, offMatch).catch(() => {});
    return offMatch;
  }

  const usdaMatch = await fetchFromUsda(trimmedBarcode, signal).catch(() => null);
  if (usdaMatch) {
    setCachedBarcode(trimmedBarcode, usdaMatch).catch(() => {});
    return usdaMatch;
  }

  throw new ProductNotFoundError(trimmedBarcode);
}
