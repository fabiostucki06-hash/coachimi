import { router } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { DateSelector } from '@/components/features/DateSelector';
import { UserAvatar } from '@/components/features/UserAvatar';
import { GoldBarBadge } from '@/components/ui/GoldBarBadge';
import { HardRefreshButton } from '@/components/ui/HardRefreshButton';
import { useRewardStore } from '@/store/rewardStore';
import { useSyncStore } from '@/store/syncStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';

// Below this viewport width (iPhone SE and similar) the coin badge and avatar
// shrink so the brand mark, date navigator, and actions all fit on one line
// without horizontal clipping.
const NARROW_VIEWPORT_PX = 380;

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface HeaderProps {
  /** Forwarded to the Date Navigator - opens a detail view for a tapped calendar-grid day. */
  onDaySelected?: (dateKey: string) => void;
}

export function Header({ onDaySelected }: HeaderProps = {}) {
  const { width } = useWindowDimensions();
  const isNarrow = width <= NARROW_VIEWPORT_PX;

  const date = useUiStore((state) => state.selectedDate);
  const user = useUserStore((state) => state.user);
  const session = useSyncStore((state) => state.session);
  const syncStatus = useSyncStore((state) => state.status);
  const remoteUpdatedAt = useSyncStore((state) => state.remoteUpdatedAt);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const syncNow = useSyncStore((state) => state.syncNow);
  const syncedAt = remoteUpdatedAt ?? lastSyncedAt;
  const activeBorder = useRewardStore((state) => state.activeBorder);

  const selectedDateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <View className="flex-row items-center justify-between overflow-hidden border-b border-surface-border bg-background px-4 py-3 lg:px-10">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-primary" numberOfLines={1}>
          Coach imi
        </Text>
        {session ? (
          <Pressable
            onPress={() => syncNow()}
            disabled={syncStatus === 'syncing'}
            className="flex-row items-center gap-1.5 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Jetzt synchronisieren"
          >
            {syncStatus === 'syncing' ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <RefreshCw color="#A1A1AA" size={10} />
            )}
            <Text className="text-[11px] text-text-secondary" numberOfLines={1}>
              {syncedAt ? formatSyncTime(syncedAt) : '–'}
            </Text>
          </Pressable>
        ) : (
          <Text className="text-[11px] text-text-secondary" numberOfLines={1}>
            {selectedDateLabel}
          </Text>
        )}
      </View>

      <View className="z-20 min-w-0 max-w-[46%] shrink items-center px-1">
        <DateSelector compact onDaySelected={onDaySelected} />
      </View>

      <View className="flex-1 flex-row items-center justify-end gap-1.5">
        <GoldBarBadge compact={isNarrow} />
        <HardRefreshButton compact={isNarrow} />
        <Pressable
          onPress={() => router.push('/(tabs)/profil')}
          accessibilityLabel="Zum Profil"
          hitSlop={8}
          className="active:opacity-80"
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} frameId={activeBorder} size={isNarrow ? 28 : 32} />
        </Pressable>
      </View>
    </View>
  );
}
