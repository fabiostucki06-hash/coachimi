// Service worker for Coach imi's PWA shell. `web.output: "single"` (app.json)
// means every route - including /widget, the OLED widget shortcut - is
// really the same index.html + JS bundle, so this worker's job is making
// that shell load instantly (even offline) and relaying live "data changed"
// pings between open windows so a widget window reflects a change made in
// another one the moment it happens, not just on next cold load. There is no
// push/Background Sync API involved - this is a static Vercel export with no
// server to push from - "real time" here means "as fast as postMessage
// between windows this worker controls".
//
// Cache-busting for a *new deploy* is primarily handled by hooks/useAutoUpdate.ts
// (polls /build-version.json, then calls utils/hardRefresh.ts's
// clearCachesAndReload, which deletes every Cache Storage entry - including
// this worker's - via `caches.keys()`). As a second line of defense,
// hooks/useServiceWorker.ts calls `registration.update()` on the same
// triggers (load/focus/visibility) so the browser re-fetches this file and
// notices a byte-diff sooner than its own background update check would.
// That only matters if this file's *contents* actually changed, so bump
// CACHE_NAME (v1 -> v2 -> ...) whenever a shell/layout fix needs to reach
// already-installed clients - the version bump is what makes the update
// detectable. `activate` below then deletes every cache key that isn't the
// current CACHE_NAME, so the old shell cache never lingers.

const CACHE_NAME = 'coach-imi-shell-v3';
const SHELL_URLS = ['/', '/manifest.json'];

// User data (diary, profile, diet cycles) lives in Supabase, a cross-origin host
// this worker never intercepts (see the origin check in the fetch handler). These
// prefixes are a second line of defense in case the app is ever fronted by a
// same-origin proxy/API route: such responses must always hit the network.
const NEVER_CACHE_PREFIXES = ['/api/', '/rest/', '/auth/', '/realtime/', '/storage/', '/functions/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const path = new URL(request.url).pathname;
  // useAutoUpdate polls this with its own cache: 'no-store' to detect a new
  // deploy - never intercept it, or a stale worker could mask that check
  // from itself and nobody would ever get prompted to reload.
  if (path === '/build-version.json') return;
  if (NEVER_CACHE_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put('/', copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? caches.match(request))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Honor the server's own "don't store this" - only successful, cacheable
        // static responses go into the shell cache.
        const cacheControl = response.headers.get('Cache-Control') ?? '';
        if (response.ok && !/no-store|no-cache|private/i.test(cacheControl)) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
    }),
  );
});

// Relays a "data changed" ping to every other open window this worker
// controls. The /widget shortcut opens as its own top-level window, not a
// child of the main app tab, so the two have no other channel to reach each
// other on.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'coach-imi-data-changed') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.id !== event.source?.id) client.postMessage({ type: 'coach-imi-data-changed' });
      }
    }),
  );
});
