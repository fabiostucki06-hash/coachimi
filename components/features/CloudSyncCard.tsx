import { router } from 'expo-router';
import { AlertCircle, Check, Cloud, LogOut, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { useSyncStore } from '@/store/syncStore';

function formatSyncedAt(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'medium' });
}

export function CloudSyncCard() {
  const session = useSyncStore((state) => state.session);
  const status = useSyncStore((state) => state.status);
  const error = useSyncStore((state) => state.error);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const remoteUpdatedAt = useSyncStore((state) => state.remoteUpdatedAt);
  const signOut = useSyncStore((state) => state.signOut);
  const syncNow = useSyncStore((state) => state.syncNow);
  const pullNow = useSyncStore((state) => state.pullNow);

  if (!session) return null;

  async function handleSignOut() {
    await signOut();
    router.replace('/onboarding');
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-overlay/5 ">
            {status === 'syncing' ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : status === 'error' ? (
              <AlertCircle color="#ef4444" size={18} />
            ) : status === 'synced' ? (
              <Check color="#6366F1" size={18} />
            ) : (
              <Cloud color="#A1A1AA" size={18} />
            )}
          </View>
          <View>
            <Text className="text-sm font-semibold text-text-secondary">Cloud-Sync</Text>
            {status === 'synced' && (remoteUpdatedAt || lastSyncedAt) && (
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-text-secondary">
                  Zuletzt synchronisiert: {formatSyncedAt(remoteUpdatedAt ?? lastSyncedAt!)}
                </Text>
                <Pressable
                  onPress={() => pullNow()}
                  accessibilityRole="button"
                  accessibilityLabel="Jetzt aktualisieren"
                  className="h-5 w-5 items-center justify-center rounded-full active:opacity-60"
                >
                  <RefreshCw color="#A1A1AA" size={12} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="h-10 w-10 items-center justify-center rounded-2xl border border-surface-border bg-surface backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
        >
          <LogOut color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      {status === 'error' ? (
        <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-red-200/60 bg-red-50/70 px-3 py-2 dark:border-red-500/20 dark:bg-red-500/10">
          <Text className="flex-1 text-xs text-red-600 dark:text-red-400" numberOfLines={2}>
            {error ?? 'Sync fehlgeschlagen'}
          </Text>
          <Pressable
            onPress={() => syncNow()}
            className="rounded-xl border border-red-300/60 bg-surface px-3 py-1.5 active:opacity-80 dark:border-red-500/30 "
          >
            <Text className="text-xs font-semibold text-red-600 dark:text-red-400">Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}
