import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Registers the PWA shell worker (public/sw.js) on web only - caches the app
 * shell so a home-screen shortcut (e.g. /widget) opens instantly even cold or
 * offline, and relays "data changed" pings between open windows (see
 * notifyDataChanged below). No-op on native, where there's no `navigator` or
 * installable shell to register.
 *
 * Also proactively calls `registration.update()` on load/focus/visibility -
 * the same triggers hooks/useAutoUpdate.ts polls build-version.json on - so a
 * changed sw.js (see its CACHE_NAME comment) is picked up as soon as
 * possible instead of waiting for the browser's own infrequent background
 * check. The worker's own `activate` handler deletes any stale cache once
 * the new version takes over; useAutoUpdate's content-hash check remains the
 * primary way clients pick up a fresh deploy.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
      })
      .catch((error) => {
        console.error('[useServiceWorker] registration failed:', error);
      });

    const checkForNewWorker = () => {
      registration?.update().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForNewWorker();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkForNewWorker);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkForNewWorker);
    };
  }, []);
}

/**
 * Pings the active service worker so it can relay a "data changed" message to
 * every other window it controls. Call this whenever data a widget view
 * cares about changes - see pushWidgetSnapshot in useWidgetSync.ts, which is
 * the one call site today. Safe to call anywhere: no-ops on native, before
 * the worker has registered, or before it has taken control of this page.
 */
export function notifyDataChanged(): void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: 'coach-imi-data-changed' });
}
