import type { FoodItem } from '@/types';

// Session-lifetime in-memory cache for Open Food Facts search results, keyed by
// normalized query text. Returning to a query already searched this session is
// instant (0ms, no network) instead of re-debouncing and re-fetching.
const cache = new Map<string, FoodItem[]>();

export function getCachedSearch(normalizedQuery: string): FoodItem[] | undefined {
  return cache.get(normalizedQuery);
}

export function setCachedSearch(normalizedQuery: string, results: FoodItem[]): void {
  cache.set(normalizedQuery, results);
}
