import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

// The app's actual URL scheme is "coachimi" (see app.json), not the
// "myfitnessapp" example scheme from generic widget instructions. A native
// widget's compiled code can't know this app's internal Expo Router file
// paths either, so it calls a small set of stable action names
// (coachimi://scan, coachimi://rewards, ...) instead - this table is the only
// place those action names need to line up with the routes that actually
// exist in this app.
const WIDGET_ACTION_ROUTES: Record<string, Href> = {
  scan: '/barcode-scanner',
  'add-food': '/add-food',
  rewards: '/rewards',
  // No water-logging feature exists in this app yet - route to the diary
  // instead of a non-existent modal so the link degrades gracefully.
  'log-water': '/',
};

function routeForUrl(url: string): Href | null {
  const { hostname, path } = Linking.parse(url);
  const action = hostname ?? path?.replace(/^\//, '') ?? null;
  if (!action) return null;
  return WIDGET_ACTION_ROUTES[action] ?? null;
}

function handleUrl(url: string | null) {
  if (!url) return;
  const route = routeForUrl(url);
  if (route) router.push(route);
}

/** Listens for widget/home-screen launch URLs (coachimi://scan, coachimi://rewards, ...) and opens the matching modal. Call once from the app root. */
export function useWidgetDeepLinks() {
  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);
}
