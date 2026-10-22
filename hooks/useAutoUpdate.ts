import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { clearCachesAndReload } from '@/utils/hardRefresh';

const CHECK_INTERVAL_MS = 2 * 60 * 1000;
// Remembers which deployed version we already reloaded for, so a CDN edge that
// still serves the previous index.html for a few seconds after a deploy can't
// trap the tab in an endless reload loop.
const RELOADED_FOR_KEY = 'coach-imi-reloaded-for-version';

async function fetchBuildVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/build-version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

function readReloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR_KEY);
  } catch {
    return null;
  }
}

function writeReloadedFor(version: string) {
  try {
    sessionStorage.setItem(RELOADED_FOR_KEY, version);
  } catch {
    // storage unavailable (private mode) - the reload itself still works
  }
}

/**
 * Makes every open of the web app/PWA land on the newest Vercel deployment:
 * checks build-version.json right on start, whenever the app comes back to
 * the foreground (tab focus, visibility, iOS bfcache restore, reconnect) and
 * every couple of minutes while open, and hard-reloads on a mismatch.
 */
export function useAutoUpdate() {
  // The version this bundle was actually built with, baked in at build time.
  // Used as the ground-truth baseline instead of trusting whatever the first
  // poll happens to return, which could already reflect a newer deploy if a
  // release lands between page load and that first check.
  const knownVersionRef = useRef<string | null>(process.env.EXPO_PUBLIC_BUILD_VERSION ?? null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    let checking = false;

    const checkForUpdate = async () => {
      if (checking) return;
      checking = true;
      const latestVersion = await fetchBuildVersion();
      checking = false;
      if (cancelled || !latestVersion) return;

      if (knownVersionRef.current === null) {
        knownVersionRef.current = latestVersion;
        return;
      }

      if (latestVersion === knownVersionRef.current) return;
      // Already reloaded once for this exact version and still got the old
      // bundle - the CDN hasn't caught up yet. Wait for the next trigger
      // instead of reloading again immediately.
      if (readReloadedFor() === latestVersion) return;

      writeReloadedFor(latestVersion);
      clearCachesAndReload();
    };

    checkForUpdate();
    const intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    // iOS home-screen apps are often restored from the back/forward cache
    // when reopened, which skips a fresh load entirely.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', checkForUpdate);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);
}
