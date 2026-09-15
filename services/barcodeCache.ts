import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FoodItem } from '@/types';

const STORAGE_KEY = 'coach-imi-barcode-cache-v1';
/** Caps on-device storage growth - old entries fall off (insertion-order eviction) rather than accumulating forever. */
const MAX_ENTRIES = 300;

let cache: Map<string, FoodItem> | null = null;
let loadPromise: Promise<Map<string, FoodItem>> | null = null;

/** Lazily loads the persisted cache once per app session; every call after the first resolves instantly from the in-memory Map. */
async function load(): Promise<Map<string, FoodItem>> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const entries = raw ? (JSON.parse(raw) as [string, FoodItem][]) : [];
        cache = new Map(entries);
        return cache;
      })
      .catch(() => {
        cache = new Map();
        return cache;
      });
  }
  return loadPromise;
}

async function persist(map: Map<string, FoodItem>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries()))).catch(() => {});
}

function put(map: Map<string, FoodItem>, barcode: string, item: FoodItem): void {
  // Re-insert to move this entry to the "most recently used" end of the Map's
  // insertion order, so eviction below drops genuinely stale entries first.
  map.delete(barcode);
  map.set(barcode, item);
  while (map.size > MAX_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

/**
 * Offline-first barcode lookup - a hit here needs no network at all, so a
 * previously scanned product (or a prefetched Swiss staple, see
 * services/staplePrefetch.ts) resolves instantly even with no connectivity.
 */
export async function getCachedBarcode(barcode: string): Promise<FoodItem | null> {
  const map = await load();
  return map.get(barcode) ?? null;
}

/** Records a resolved barcode so the next scan of the same product - online or offline - resolves instantly from this cache instead of Open Food Facts/USDA. */
export async function setCachedBarcode(barcode: string, item: FoodItem): Promise<void> {
  const map = await load();
  put(map, barcode, item);
  await persist(map);
}

/** Bulk variant for prefetching a batch of staples in one write instead of one AsyncStorage round-trip per item. */
export async function setCachedBarcodes(items: FoodItem[]): Promise<void> {
  const map = await load();
  for (const item of items) {
    put(map, item.id, item);
  }
  await persist(map);
}
