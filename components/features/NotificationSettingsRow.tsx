import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import {
  DAILY_REMINDERS,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '@/services/notificationService';
import { subscribeUserToPush, unsubscribeUserFromPush } from '@/services/pushNotificationService';
import { useNotificationStore } from '@/store/notificationStore';
import { useToastStore } from '@/store/toastStore';

const REMINDER_TIMES = DAILY_REMINDERS.map((reminder) => `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`).join(', ');

/** Why the switch is unavailable, phrased as the thing the user can actually do about it. */
const BLOCKED_HINTS: Partial<Record<NotificationPermissionState, string>> = {
  'needs-install': 'Auf dem iPhone brauchst du Coach imi auf dem Home-Bildschirm: Teilen-Symbol → "Zum Home-Bildschirm". Danach kannst du Mitteilungen erlauben.',
  denied: 'Mitteilungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen deines Geräts.',
  unsupported: 'Dieser Browser unterstützt keine Mitteilungen.',
};

function toast(message: string, variant: 'success' | 'error') {
  useToastStore.getState().show(message, variant);
}

/**
 * Settings switch for meal reminders. Turning it on asks the device for
 * notification permission and registers this browser for Web Push; the
 * reminders themselves are delivered by the OS as system banners (see
 * services/notificationService.ts), never as something drawn inside the app.
 * Web (PWA) only. Rendered as a flat settings-list row (no card chrome) - the
 * parent section provides the grouping and hairline dividers.
 */
export function NotificationSettingsRow() {
  const enabled = useNotificationStore((state) => state.remindersEnabled);
  const setEnabled = useNotificationStore((state) => state.setRemindersEnabled);
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== 'web') return null;

  const permission = getNotificationPermission();
  const hint = BLOCKED_HINTS[permission];
  const isOn = enabled && permission === 'granted';
  // 'default' (nothing decided yet) still allows the switch - that tap is the
  // user gesture the permission prompt needs.
  const canToggle = permission === 'granted' || permission === 'default';

  async function handleToggle(next: boolean) {
    if (!next) {
      setEnabled(false);
      void unsubscribeUserFromPush();
      return;
    }

    setBusy(true);
    try {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        setEnabled(true);
        toast(`Erinnerungen aktiviert (${REMINDER_TIMES} Uhr).`, 'success');
        // Best-effort: the local schedule already works without this - push
        // is what makes the banners arrive with the app fully closed.
        void subscribeUserToPush();
      } else {
        setEnabled(false);
        toast(BLOCKED_HINTS[result] ?? 'Ohne Berechtigung können keine Erinnerungen gesendet werden.', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Bell size={18} color="#6366F1" strokeWidth={1.75} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium leading-5 text-foreground">Push-Mitteilungen</Text>
        <Text className="text-xs leading-4 text-text-secondary">
          {hint ?? `Erinnerungen um ${REMINDER_TIMES} Uhr, auch bei geschlossener App.`}
        </Text>
      </View>
      <Switch
        value={isOn}
        onValueChange={handleToggle}
        disabled={!canToggle || busy}
        accessibilityLabel="Push-Mitteilungen"
        trackColor={{ false: '#3F3F46', true: '#6366F1' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
