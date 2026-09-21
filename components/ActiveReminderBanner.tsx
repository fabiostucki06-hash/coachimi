import { router, usePathname } from 'expo-router';
import { BellRing, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getInactivityReference,
  getLastMealLoggedAt,
  shouldShowInactivityReminder,
} from '@/services/notificationService';
import { useDiaryStore } from '@/store/diaryStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useUserStore } from '@/store/userStore';

const CHECK_INTERVAL_MS = 60 * 1000;

// Screens where the banner would cover the very thing being done (logging a
// meal, onboarding) or the OLED widget window.
const HIDDEN_PATHS = new Set([
  '/widget',
  '/onboarding',
  '/setup',
  '/add-food',
  '/log-quantity',
  '/barcode-scanner',
  '/analyze-food',
  '/meal-parser',
]);

function formatHours(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
}

/**
 * In-app nudge: shown when the reminders switch is on, it's daytime and the
 * newest logged meal (from the diary store, which cloud sync keeps current with
 * Supabase) is more than 4 hours old - see shouldShowInactivityReminder for
 * the exact rule. Dismissing hides it until a newer meal is logged and that
 * one, too, ages past the threshold.
 */
export function ActiveReminderBanner() {
  const pathname = usePathname();
  const enabled = useNotificationStore((state) => state.remindersEnabled);
  const hasOnboarded = useUserStore((state) => state.hasOnboarded);
  const entriesByDate = useDiaryStore((state) => state.entriesByDate);
  const lastLoggedAt = useMemo(() => getLastMealLoggedAt(entriesByDate), [entriesByDate]);

  const [now, setNow] = useState(() => new Date());
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled || !hasOnboarded || HIDDEN_PATHS.has(pathname)) return null;
  if (!shouldShowInactivityReminder(now, lastLoggedAt)) return null;

  const reference = getInactivityReference(now, lastLoggedAt);
  if (dismissedFor === reference) return null;

  const gapMs = now.getTime() - reference;

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" className="absolute inset-x-0 top-0 z-40 items-center px-4">
      <View className="mt-12 w-full max-w-md flex-row items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] px-4 py-3">
        <BellRing color="#818CF8" size={18} />
        <Pressable
          onPress={() => router.push('/add-food')}
          accessibilityRole="button"
          accessibilityLabel="Mahlzeit eintragen"
          className="flex-1 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-white">Schon {formatHours(gapMs)} nichts eingetragen</Text>
          <Text className="text-xs text-white/60">Tippe hier, um deine nächste Mahlzeit zu loggen.</Text>
        </Pressable>
        <Pressable
          onPress={() => setDismissedFor(reference)}
          accessibilityRole="button"
          accessibilityLabel="Hinweis schließen"
          className="h-8 w-8 items-center justify-center rounded-full bg-white/10 active:opacity-80"
        >
          <X color="#A1A1AA" size={14} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
