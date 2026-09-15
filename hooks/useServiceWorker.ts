import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Registers the PWA shell worker (public/sw.js) on web only - caches the app
 * shell so a home-screen shortcut (e.g. /widget) opens instantly even cold or
 * offline, and relays "data changed" pings between open windows (see
 * notifyDataChanged below). No-op on native, where there's no `navigator` or
 * installable shell to register.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[useServiceWorker] registration failed:', error);
    });
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
