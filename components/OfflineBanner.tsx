import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOfflineQueueStore } from '@/services/offlineQueue';
import { useSyncStore } from '@/store/syncStore';

/**
 * Subtle OLED status chip, top-of-screen - only for a signed-in user with
 * either no connection or an unsynced backlog. Hidden completely once both
 * are clear again (see services/syncManager.ts for how `online` and
 * `pendingDates` get reset). No popups, no dismiss action - it goes away on
 * its own the moment the queue drains.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const session = useSyncStore((state) => state.session);
  const online = useOfflineQueueStore((state) => state.online);
  const pendingCount = useOfflineQueueStore((state) => state.pendingDates.length);

  if (!session || (online && pendingCount === 0)) return null;

  const label = online
    ? `Synchronisiere … ${pendingCount} ausstehend`
    : pendingCount > 0
      ? `Offline • ${pendingCount} ausstehend`
      : 'Offline';

  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 z-50 items-center" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-[#121212] px-3 py-1.5">
        <View className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-amber-400' : 'bg-red-400'}`} />
        <Text className="text-[11px] font-medium text-white/70">{label}</Text>
      </View>
    </View>
  );
}
