import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import {
  DAILY_REMINDERS,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/services/notificationService';
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
      return;
    }

    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        setEnabled(true);
        toast(`Erinnerungen aktiviert (${REMINDER_TIMES} Uhr).`, 'success');
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
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold text-foreground">Mitteilungen & Erinnerungen aktivieren</Text>
          <Text className="text-xs text-text-secondary">
            {supported
              ? `Erinnert dich um ${REMINDER_TIMES} Uhr ans Loggen und zeigt einen Hinweis, wenn du tagsüber länger als 4 Stunden nichts eingetragen hast. Erinnerungen kommen, solange die App geöffnet oder im Hintergrund aktiv ist.`
              : 'Mitteilungen werden von diesem Browser nicht unterstützt. Auf dem iPhone funktionieren sie nur in der zum Home-Bildschirm hinzugefügten App.'}
          </Text>
        </View>
        <Switch
          value={isOn}
          onValueChange={handleToggle}
          disabled={!supported || busy}
          accessibilityLabel="Mitteilungen und Erinnerungen aktivieren"
          trackColor={{ false: '#52525B', true: '#6366F1' }}
          thumbColor="#ffffff"
        />
      </View>
    </Card>
  );
}
