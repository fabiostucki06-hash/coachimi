import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { requestNotificationPermission } from '@/services/notificationService';

// Web Push subscription lifecycle. This is what lets a reminder reach the
// user when the PWA is fully closed - services/notificationService.ts's
// setTimeout-based reminders only fire while the tab (or its background
// service worker process) is still alive. Native (iOS/Android app) has no
// PushManager, so every export here is a web-only no-op elsewhere.

function readEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

const VAPID_PUBLIC_KEY = readEnv(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY);

/** PushManager wants the VAPID key as a raw Uint8Array, browsers hand out base64url. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isPushSupported(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Asks for notification permission (if not already decided), subscribes this
 * browser to Web Push and upserts the subscription into Supabase so the
 * send-push-reminders edge function can reach it. Safe to call repeatedly -
 * an existing PushManager subscription is reused, not recreated. Returns
 * whether the subscription is now stored server-side.
 */
export async function subscribeUserToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.error('[push] Fehlende Konfiguration: EXPO_PUBLIC_VAPID_PUBLIC_KEY ist nicht gesetzt.');
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const keys = subscription.toJSON().keys;
    if (!keys?.p256dh || !keys?.auth) return false;

    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert(
        { user_id: userId, endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint' },
      );
    if (error) {
      console.error('[push] subscribe upsert failed:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[push] subscribe failed:', error);
    return false;
  }
}

/**
 * Unsubscribes this browser from Web Push and removes its row server-side.
 * Best-effort: local reminders (notificationService.ts) still work off the
 * Settings flag regardless of whether this succeeds.
 */
export async function unsubscribeUserFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from('user_push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (error) {
    console.error('[push] unsubscribe failed:', error);
  }
}
