import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Receiving end of the `notificationclick` handler in public/sw.js. Tapping a
// system banner has to reach a screen inside the app, and neither half of
// that can go through the URL bar: app/_layout.tsx redirects every fresh load
// whose pathname isn't '/', '/widget' or the workout-import link straight
// back to the dashboard. So the worker sends the route either as a
// postMessage (a window was already open) or as '/?route=...' (it had to open
// one), and both land here.

/** Routes a notification is allowed to open. Anything else is ignored rather than pushed blindly - the value travels through a URL the user can edit. */
const ALLOWED_ROUTES: Record<string, Href> = {
  '/': '/',
  '/add-food': '/add-food',
  '/barcode-scanner': '/barcode-scanner',
};

function resolveRoute(value: string | null | undefined): Href | null {
  if (!value) return null;
  // Drop any query/hash before matching so '/add-food?x=1' can't slip past the allowlist.
  const path = value.split(/[?#]/)[0];
  return ALLOWED_ROUTES[path] ?? null;
}

/** Reads the one-shot `?route=` hand-off and takes it back out of the address bar, so a reload doesn't re-open the same modal. */
function consumeRouteParam(): Href | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('route');
  if (!raw) return null;

  params.delete('route');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));

  return resolveRoute(raw);
}

/** Opens the screen a tapped notification points at. Call once from the app root. */
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const initial = consumeRouteParam();
    // The root layout's own redirect effect runs on this same mount; defer so
    // this push lands after it instead of being replaced by it.
    if (initial && initial !== '/') {
      const timer = setTimeout(() => router.push(initial), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'coach-imi-open-route') return;
      const route = resolveRoute(event.data.route);
      if (route) router.push(route);
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);
}
