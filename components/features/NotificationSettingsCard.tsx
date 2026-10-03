import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
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
 * Web (PWA) only.
 */
export function NotificationSettingsCard() {
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
    <Card>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Bell size={18} color="#A1A1AA" />
          <Text className="text-sm font-semibold text-foreground">Push-Mitteilungen</Text>
        </View>
        <Switch
          value={isOn}
          onValueChange={handleToggle}
          disabled={!canToggle || busy}
          accessibilityLabel="Push-Mitteilungen"
          trackColor={{ false: '#27272A', true: '#6366F1' }}
          thumbColor="#000000"
        />
      </View>
      <Text className="mt-2 text-xs text-text-secondary">
        {hint ?? `Erinnerungen um ${REMINDER_TIMES} Uhr - als Mitteilung deines Geräts, auch wenn die App geschlossen ist.`}
      </Text>
    </Card>
  );
}
