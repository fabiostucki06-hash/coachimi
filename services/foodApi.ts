import type { FoodItem } from '@/types';

const SEARCH_URL = 'https://de.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 8000;
/** Background search fallback gets a tighter budget so typing never feels blocked by a slow network. */
const SEARCH_TIMEOUT_MS = 3000;

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

export async function searchFood(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(trimmedQuery)}&search_simple=1&action=process&json=1&page_size=20`;
  const data = await fetchJson<OffSearchResponse>(url, signal, SEARCH_TIMEOUT_MS);
  if (__DEV__) console.log('OFF Raw API Response:', data);
  const products = data.products ?? [];

  return products
    .filter((product) => (product.product_name || product.product_name_de) && hasAnyMacro(product.nutriments ?? {}))
    .map((product, index) => ({ ...normalizeFoodItem(product, `search-${index}`), source: 'off' as const }));
}

export async function getFoodByBarcode(barcode: string): Promise<FoodItem> {
  const trimmedBarcode = barcode.trim();
  if (!trimmedBarcode) {
    throw new FoodApiError('Barcode darf nicht leer sein.');
  }

  const url = `${PRODUCT_URL}/${encodeURIComponent(trimmedBarcode)}.json`;
  const data = await fetchJson<OffProductResponse>(url);

  if (data.status !== 1 || !data.product) {
    throw new ProductNotFoundError(trimmedBarcode);
  }

  return normalizeFoodItem(data.product, trimmedBarcode);
}
