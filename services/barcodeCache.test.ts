import type { FoodItem } from '@/types';

const item = (id: string): FoodItem => ({
  id,
  name: `Product ${id}`,
  caloriesPerServing: 100,
  macrosPerServing: { carbs: 10, protein: 5, fat: 2 },
  micronutrientsPerServing: {},
  servingSize: 100,
  servingUnit: 'g',
  source: 'off',
});

// Fresh module registry per test (not just AsyncStorage.clear()) - barcodeCache.ts
// keeps its own in-memory Map alongside AsyncStorage, and that Map would otherwise
// carry cached entries over between tests regardless of what storage was cleared to.
let AsyncStorage: typeof import('@react-native-async-storage/async-storage').default;
let barcodeCache: typeof import('./barcodeCache');

beforeEach(() => {
  jest.resetModules();
  jest.doMock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
  );
  AsyncStorage = require('@react-native-async-storage/async-storage');
  barcodeCache = require('./barcodeCache');
});

it('returns null for a barcode that was never cached', async () => {
  expect(await barcodeCache.getCachedBarcode('does-not-exist')).toBeNull();
});

it('persists a cached barcode to AsyncStorage, not just an in-memory Map', async () => {
  await barcodeCache.setCachedBarcode('4008400123456', item('4008400123456'));

  expect((await barcodeCache.getCachedBarcode('4008400123456'))?.id).toBe('4008400123456');
  // A raw AsyncStorage read (bypassing this module's in-memory Map entirely) must
  // also see it - proves the write actually reached storage, not just memory.
  const raw = await AsyncStorage.getItem('coach-imi-barcode-cache-v1');
  const persistedEntries: [string, unknown][] = JSON.parse(raw ?? '[]');
  expect(persistedEntries.some(([barcode]) => barcode === '4008400123456')).toBe(true);
});

it('evicts the oldest entry once the cache exceeds its cap', async () => {
  for (let i = 0; i < 301; i++) {
    await barcodeCache.setCachedBarcode(`code-${i}`, item(`code-${i}`));
  }

  expect(await barcodeCache.getCachedBarcode('code-0')).toBeNull();
  expect(await barcodeCache.getCachedBarcode('code-300')).not.toBeNull();
});

it('caches a batch of items in one write', async () => {
  await barcodeCache.setCachedBarcodes([item('1'), item('2'), item('3')]);

  expect(await barcodeCache.getCachedBarcode('2')).not.toBeNull();
});
