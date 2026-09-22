import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import {
  DAILY_REMINDERS,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/services/notificationService';
import { subscribeUserToPush, unsubscribeUserFromPush } from '@/services/pushNotificationService';
import { useNotificationStore } from '@/store/notificationStore';
import { useToastStore } from '@/store/toastStore';

const REMINDER_TIMES = DAILY_REMINDERS.map((reminder) => `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`).join(', ');

function toast(message: string, variant: 'success' | 'error') {
  useToastStore.getState().show(message, variant);
}

/** Settings switch for meal reminders. Turning it on asks the browser for notification permission first; the schedule itself is run by hooks/useReminderScheduler.ts off the persisted flag. Web (PWA) only. */
export function NotificationSettingsCard() {
  const enabled = useNotificationStore((state) => state.remindersEnabled);
  const setEnabled = useNotificationStore((state) => state.setRemindersEnabled);
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== 'web') return null;

  const supported = isNotificationSupported();
  const isOn = enabled && getNotificationPermission() === 'granted';

  async function handleToggle(next: boolean) {
    if (!next) {
      setEnabled(false);
      void unsubscribeUserFromPush();
      return;
    }

    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        setEnabled(true);
        toast(`Erinnerungen aktiviert (${REMINDER_TIMES} Uhr).`, 'success');
        // Best-effort: local reminders (above) already work without this -
        // push just makes them reach a fully closed app too.
        void subscribeUserToPush();
      } else {
        setEnabled(false);
        toast(
          permission === 'denied'
            ? 'Mitteilungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen.'
            : permission === 'unsupported'
              ? 'Mitteilungen sind hier nicht verfügbar.'
              : 'Ohne Berechtigung können keine Erinnerungen gesendet werden.',
          'error',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Bell size={18} color="#A1A1AA" />
          <Text className="text-sm font-semibold text-foreground">Push-Mitteilungen</Text>
        </View>
        <Switch
          value={isOn}
          onValueChange={handleToggle}
          disabled={!supported || busy}
          accessibilityLabel="Push-Mitteilungen"
          trackColor={{ false: '#27272A', true: '#6366F1' }}
          thumbColor="#000000"
        />
      </View>
    </Card>
  );
}
