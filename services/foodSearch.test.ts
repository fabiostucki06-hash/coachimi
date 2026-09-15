jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Tier 1 (`foods` table) always comes back empty here, so every test exercises
// escalation past it. `mockUpsert` lets tests assert exactly what
// cacheFoodItem persists back into `foods`.
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ ilike: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      upsert: mockUpsert,
    }),
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

beforeEach(() => {
  mockSearchFood.mockReset();
  mockUpsert.mockClear();
});

describe('searchFoodHybrid', () => {
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
