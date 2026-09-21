// Service worker for Coach imi's PWA shell. `web.output: "single"` (app.json)
// means every route - including /widget, the OLED widget shortcut - is
// really the same index.html + JS bundle, so this worker's job is making
// that shell load instantly (even offline) and relaying live "data changed"
// pings between open windows so a widget window reflects a change made in
// another one the moment it happens, not just on next cold load. "Real time"
// for the widget means "as fast as postMessage between windows this worker
// controls" - no Background Sync API is involved.
//
// The `push` handler at the bottom turns a Web Push message into a system
// notification and `notificationclick` focuses/opens the app. Nothing sends
// pushes yet: this is a static Vercel export, so delivering one needs a
// backend holding VAPID keys and the users' PushManager subscriptions. The
// in-app reminders (services/notificationService.ts) don't use push at all -
// the page schedules them and shows them via registration.showNotification.
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

// Web Push -> system notification. Payload is JSON: { title, body, url? }.
// A non-JSON or empty payload falls back to a generic reminder instead of
// dropping the push - browsers expect a push to show *something*.
const NOTIFICATION_ICON = '/icon.png';
const DEFAULT_NOTIFICATION = { title: 'Coach imi', body: 'Erinnerung' };

self.addEventListener('push', (event) => {
  let data = DEFAULT_NOTIFICATION;
  if (event.data) {
    try {
      data = { ...DEFAULT_NOTIFICATION, ...event.data.json() };
    } catch {
      data = { ...DEFAULT_NOTIFICATION, body: event.data.text() || DEFAULT_NOTIFICATION.body };
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: 'coachimi-notification',
      data: { url: data.url || '/' },
    }),
  );
});

// Only same-origin targets are honored, so a malformed payload can't turn a
// tap on the notification into an open redirect.
function resolveNotificationUrl(url) {
  try {
    const target = new URL(url || '/', self.location.origin);
    return target.origin === self.location.origin ? target.href : self.location.origin + '/';
  } catch {
    return self.location.origin + '/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = resolveNotificationUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      return existing ? existing.focus() : self.clients.openWindow(target);
    }),
  );
});
