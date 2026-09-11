import { Pressable, Text, View } from 'react-native';

import { useSyncStore } from '@/store/syncStore';

/** Shown at the top of the training screen when the last Supabase push failed - the finished workout is already safe in local storage (trainingStore persists to AsyncStorage independent of network), it just hasn't reached the cloud backup yet. Reuses the same auto-retry-on-reconnect status/syncNow the rest of the app's sync already runs on (see store/syncStore.ts), rather than a separate recovery mechanism. */
export function TrainingSyncBanner() {
  const session = useSyncStore((state) => state.session);
  const status = useSyncStore((state) => state.status);
  const syncNow = useSyncStore((state) => state.syncNow);

  if (!session || status !== 'error') return null;

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
      <Text className="flex-1 text-xs text-amber-700 dark:text-amber-400" numberOfLines={2}>
        Nicht gespeichertes Training gefunden – Jetzt nachträglich sichern
      </Text>
      <Pressable
        onPress={() => syncNow()}
        className="rounded-xl border border-amber-300/60 bg-white/70 px-3 py-1.5 active:opacity-80 dark:border-amber-500/30 dark:bg-white/5"
      >
        <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">Jetzt sichern</Text>
      </Pressable>
    </View>
  );
}
