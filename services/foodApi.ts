import { parseJsonLoose } from '@/services/aiJson';
import type { FoodItem } from '@/types';

const SEARCH_URL = 'https://de.openfoodfacts.org/cgi/search.pl';
const SEARCH_URL_WORLD = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 8000;
/** Background search fallback gets a tighter budget so typing never feels blocked by a slow network. */
const SEARCH_TIMEOUT_MS = 2500;
/** Below this many hits, escalate to the next broader search tier instead of settling for a thin result set. */
const MIN_RESULTS_BEFORE_FALLBACK = 3;
const MAX_RESULTS = 20;

// Last-resort tier: reuses the same demo-integration key as services/visionFoodApi.ts.
// Only ever consulted once every Open Food Facts tier has come back completely empty,
// and only if a key is configured - never blocks or replaces the OFF search otherwise.
const AI_ESTIMATE_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const AI_ESTIMATE_URL = 'https://api.openai.com/v1/chat/completions';
const AI_ESTIMATE_TIMEOUT_MS = 8000;

const AI_ESTIMATE_PROMPT = `Du bist ein Ernährungsexperte. Der Nutzer sucht nach einem Lebensmittel, das in keiner Datenbank
gefunden wurde. Schätze anhand des Suchbegriffs (auch bei Tippfehlern oder unvollständigen Begriffen) die durchschnittlichen
Nährwerte pro 100g für ein typisches/durchschnittliches Exemplar, inklusive Eisengehalt (ironPer100g in mg). Antworte
ausschließlich mit kompaktem JSON ohne Markdown, ohne Erklärung, in genau diesem Schema:
{"name": string, "isFood": boolean, "caloriesPer100g": number, "carbsPer100g": number, "proteinPer100g": number, "fatPer100g": number, "ironPer100g": number}
"name" ist der normalisierte, korrekt geschriebene deutsche Name des Lebensmittels. Falls der Suchbegriff erkennbar KEIN
Lebensmittel ist, setze "isFood" auf false.`;

interface AiEstimateJson {
  name?: string;
  isFood?: boolean;
  caloriesPer100g?: number;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  ironPer100g?: number;
}

function toNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : 0;
}

/** Generates a rough per-100g nutrition estimate for a generic search term via a small LLM call - only reached when Open Food Facts has nothing at all. Best-effort: any failure (no key configured, network error, malformed response) just yields no result, same as any other empty search. */
async function fetchAiEstimate(query: string, signal?: AbortSignal): Promise<FoodItem | null> {
  if (!AI_ESTIMATE_API_KEY) return null;

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), AI_ESTIMATE_TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeoutController.abort());

  let response: Response;
  try {
    response = await fetch(AI_ESTIMATE_URL, {
      method: 'POST',
      signal: timeoutController.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_ESTIMATE_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.2,
        messages: [
          { role: 'system', content: AI_ESTIMATE_PROMPT },
          { role: 'user', content: query },
        ],
      }),
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return null;

  try {
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonLoose<AiEstimateJson>(content);
    if (!parsed || parsed.isFood === false) return null;

    return {
      id: `ai-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      name: parsed.name?.trim() || query,
      caloriesPerServing: Math.round(toNonNegative(parsed.caloriesPer100g)),
      macrosPerServing: {
        carbs: toNonNegative(parsed.carbsPer100g),
        protein: toNonNegative(parsed.proteinPer100g),
        fat: toNonNegative(parsed.fatPer100g),
      },
      micronutrientsPerServing: { iron: toNonNegative(parsed.ironPer100g) },
      servingSize: 100,
      servingUnit: 'g',
      source: 'ai',
    };
  } catch {
    return null;
  }
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
      sugar: nutriments.sugars_100g || 0,
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

async function fetchJson<T>(url: string, externalSignal?: AbortSignal, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  externalSignal?.addEventListener('abort', () => timeoutController.abort());

  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutController.signal });
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
  const data = await fetchJson<OffSearchResponse>(url, signal, SEARCH_TIMEOUT_MS);
  if (__DEV__) console.log('OFF Raw API Response:', url, data);
  const products = data.products ?? [];

  return products
    .filter((product) => (product.product_name || product.product_name_de) && hasAnyMacro(product.nutriments ?? {}))
    .map((product, index) => ({ ...normalizeFoodItem(product, `search-${index}`), source: 'off' as const }));
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
 * Cascading search: a bare barcode goes straight to product lookup; otherwise runs up to
 * three progressively broader Open Food Facts tiers, stopping as soon as one has enough
 * hits - (1) DE-hosted mirror, exact terms, fastest and best match quality for German
 * products; (2) global product base scoped to German locale/country tags, for regional
 * brands the DE mirror hasn't synced yet; (3) global, no country restriction, last resort
 * for imported/obscure products. Tiers 2-3 are best-effort: a failure there just means we
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

  const primaryUrl = `${SEARCH_URL}?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${MAX_RESULTS}`;
  let results = await runSearchTier(primaryUrl, signal);
  if (results.length >= MIN_RESULTS_BEFORE_FALLBACK) return results;

  const secondaryUrl = `${SEARCH_URL_WORLD}?search_terms=${encoded}&search_simple=1&action=process&json=1&lc=de&cc=de&page_size=${MAX_RESULTS}`;
  const secondary = await runSearchTier(secondaryUrl, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, secondary]);
  if (results.length >= MIN_RESULTS_BEFORE_FALLBACK) return results;

  const tertiaryUrl = `${SEARCH_URL_WORLD}?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${MAX_RESULTS}`;
  const tertiary = await runSearchTier(tertiaryUrl, signal).catch(() => [] as FoodItem[]);
  results = mergeUniqueById([results, tertiary]);
  if (results.length > 0) return results;

  // Every OFF tier came back completely empty - last resort before "not found",
  // a rough AI estimate for generic/unbranded terms. No-op if no key is configured.
  const aiEstimate = await fetchAiEstimate(cleanQuery, signal).catch(() => null);
  return aiEstimate ? [aiEstimate] : results;
}

export async function getFoodByBarcode(barcode: string, signal?: AbortSignal): Promise<FoodItem> {
  const trimmedBarcode = barcode.trim();
  if (!trimmedBarcode) {
    throw new FoodApiError('Barcode darf nicht leer sein.');
  }

  const url = `${PRODUCT_URL}/${encodeURIComponent(trimmedBarcode)}.json`;
  const data = await fetchJson<OffProductResponse>(url, signal);

  if (data.status !== 1 || !data.product) {
    throw new ProductNotFoundError(trimmedBarcode);
  }

  return normalizeFoodItem(data.product, trimmedBarcode);
}
