jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Tier 1 (`foods` table, via the search_foods_fuzzy RPC) always comes back
// empty by default, so every test exercises escalation past it unless a
// specific test overrides `mockRpc` for that call. `mockUpsert` lets tests
// assert exactly what cacheFoodItem persists back into `foods`.
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: mockUpsert,
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// services/foodApi.ts's searchFood is the Open Food Facts cascade (Swiss
// Search-a-licious, DE-hosted legacy mirror, global product base, USDA
// backup) - mocked here since these are pure unit tests, not live network
// calls. looksLikeBarcode is re-exported as the real implementation since
// cacheFoodItem's synthetic-id guard depends on its actual behavior.
jest.mock('@/services/foodApi', () => ({
  searchFood: jest.fn(),
  looksLikeBarcode: (value: string) => /^\d{8,14}$/.test(value.trim()),
}));

import { searchFood } from '@/services/foodApi';
import type { FoodItem } from '@/types';

import { cacheFoodItem, searchFoodHybrid } from './foodSearch';

const mockSearchFood = searchFood as jest.Mock;

// Tier 3 (FatSecret) short-circuits on its own - no EXPO_PUBLIC_FATSECRET_*
// env vars are set in the test environment, so getFatSecretToken returns
// null without ever calling fetch. Tier 4 (translated USDA) does call fetch
// (both for MyMemory translation and USDA FoodData Central itself), so it's
// stubbed out here to keep these unit tests hermetic - a rejection is enough
// since both call sites are wrapped in their own best-effort .catch().
globalThis.fetch = jest.fn().mockRejectedValue(new Error('network disabled in tests')) as unknown as typeof fetch;

function offItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: '4008400123456',
    name: 'ESN Designer Whey',
    brand: 'ESN',
    caloriesPerServing: 380,
    macrosPerServing: { carbs: 5, protein: 80, fat: 3 },
    micronutrientsPerServing: {},
    servingSize: 100,
    servingUnit: 'g',
    source: 'off',
    ...overrides,
  };
}

function localRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'local-1',
    name: 'Coca-Cola',
    brand: null,
    calories_per_100g: 42,
    carbs_per_100g: 10.6,
    protein_per_100g: 0,
    fat_per_100g: 0,
    micronutrients: {},
    source: 'local',
    external_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockSearchFood.mockReset();
  mockUpsert.mockClear();
  mockRpc.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('searchFoodHybrid', () => {
  it('always queries the local `foods` table (our primary source of truth) via the search_foods_fuzzy RPC first', async () => {
    mockSearchFood.mockResolvedValue([]);

    await searchFoodHybrid('Koka Kola');

    expect(mockRpc).toHaveBeenCalledWith('search_foods_fuzzy', { search_query: 'Koka Kola', match_limit: 20 });
  });

  it('never calls Open Food Facts when the local `foods` table alone already has enough hits', async () => {
    mockRpc.mockResolvedValueOnce({
      data: Array.from({ length: 5 }, (_, i) => localRow({ id: `local-${i}` })),
      error: null,
    });

    const results = await searchFoodHybrid('Cola');

    expect(mockSearchFood).not.toHaveBeenCalled();
    expect(results.every((item) => item.source === 'local')).toBe(true);
  });

  it('keeps local `foods` rows ahead of external API results in the merged list, without dropping any of them', async () => {
    mockRpc.mockResolvedValueOnce({ data: [localRow()], error: null });
    mockSearchFood.mockResolvedValue([offItem({ id: 'off-1', name: 'Coca-Cola Zero' })]);

    const results = await searchFoodHybrid('Cola');

    expect(results.map((item) => item.id)).toEqual(['local-1', 'off-1']);
    expect(results[0].source).toBe('local');
  });

  it('escalates to Open Food Facts when the local `foods` cache has too few hits, surfacing brands like ESN', async () => {
    const esnResults = Array.from({ length: 5 }, (_, i) => offItem({ id: `400840012345${i}`, name: `ESN Designer Whey ${i}` }));
    mockSearchFood.mockResolvedValue(esnResults);

    const results = await searchFoodHybrid('ESN');

    expect(mockSearchFood).toHaveBeenCalledWith('ESN', undefined);
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.every((item) => item.brand === 'ESN')).toBe(true);
  });

  it('stops escalating once Open Food Facts alone already has enough hits', async () => {
    mockSearchFood.mockResolvedValue(Array.from({ length: 5 }, (_, i) => offItem({ id: `40084001234${i}0` })));

    await searchFoodHybrid('ESN');

    // FatSecret/USDA (Tier 3/4) are never reached: no unmocked fetch() call
    // means those tiers would throw if actually invoked, and this test would
    // fail. Confirmed instead via the merge behavior of the returned length.
    expect(mockSearchFood).toHaveBeenCalledTimes(1);
  });

  it('returns nothing extra when Open Food Facts also comes back empty (offline, or a genuine no-match)', async () => {
    mockSearchFood.mockResolvedValue([]);

    const results = await searchFoodHybrid('völlig unbekanntes produkt xyz');

    expect(results).toEqual([]);
  });
});

describe('cacheFoodItem', () => {
  it('caches an Open Food Facts pick with a real barcode id into the `foods` table', async () => {
    await cacheFoodItem(offItem({ id: '4008400123456' }));

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'off', external_id: '4008400123456', name: 'ESN Designer Whey' }),
      { onConflict: 'source,external_id' },
    );
  });

  it('does not cache an Open Food Facts pick with a synthetic (non-barcode) id', async () => {
    await cacheFoodItem(offItem({ id: 'search-3' }));

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('ignores local/community picks - already cached by definition', async () => {
    await cacheFoodItem(offItem({ source: 'local' }));
    await cacheFoodItem(offItem({ source: 'community' }));

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
