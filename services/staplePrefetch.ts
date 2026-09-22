import AsyncStorage from '@react-native-async-storage/async-storage';

import { setCachedBarcodes } from '@/services/barcodeCache';
import { looksLikeBarcode, runSwissSearchTier } from '@/services/foodApi';

const LAST_RUN_KEY = 'coach-imi-staple-prefetch-last-run';
/** Re-running this on every app open would hammer Open Food Facts for no benefit - staple products barely change week to week. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Everyday grocery terms, deliberately generic (not brand names) so the retailer-
// boosted Swiss search tier (Migros/Coop/M-Budget/Prix Garantie/Alnatura) surfaces
// each chain's own-brand version of it - real Open Food Facts data, not hardcoded
// nutrition facts, so it stays accurate as those products change.
const STAPLE_QUERIES = [
  'Milch', 'Joghurt', 'Butter', 'Käse', 'Teigwaren', 'Reis', 'Brot', 'Eier', 'Apfel', 'Orangensaft',
  'Rösti', 'Cervelat', 'Gruyère', 'Bircher Müesli', 'Zopf',
];

async function shouldRun(): Promise<boolean> {
  try {
    const lastRun = await AsyncStorage.getItem(LAST_RUN_KEY);
    if (!lastRun) return true;
    return Date.now() - Number(lastRun) > REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Seeds the offline barcode cache with common Swiss retailer staples (Migros, Coop,
 * M-Budget, Prix Garantie, Alnatura) so a scan of one of these everyday products
 * resolves instantly even with no connectivity - not just products the user has
 * already scanned once. Best-effort and fire-and-forget: any failure (offline, rate
 * limit) just means the offline cache stays as it was, never surfaced to the user.
 */
export async function prefetchSwissStaples(): Promise<void> {
  if (!(await shouldRun())) return;

  const results = await Promise.all(
    STAPLE_QUERIES.map((term) => runSwissSearchTier(term, undefined, true).catch(() => [])),
  );

  const barcodedItems = results.flat().filter((item) => looksLikeBarcode(item.id));
  if (barcodedItems.length > 0) {
    await setCachedBarcodes(barcodedItems);
  }

  await AsyncStorage.setItem(LAST_RUN_KEY, String(Date.now())).catch(() => {});
}
