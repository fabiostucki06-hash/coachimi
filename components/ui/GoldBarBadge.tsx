import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useRewardStore } from '@/store/rewardStore';

export function GoldBarBadge() {
  const goldBars = useRewardStore((state) => state.goldBars);

  return (
    <Pressable
      className="h-9 flex-row items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80"
      onPress={() => router.push('/rewards')}
      accessibilityLabel={`${goldBars} Goldbarren – Belohnungen öffnen`}
    >
      <Text className="text-sm">🪙</Text>
      <Text className="text-sm font-bold tracking-tight text-amber-600 dark:text-amber-400">{goldBars}</Text>
    </Pressable>
  );
}
