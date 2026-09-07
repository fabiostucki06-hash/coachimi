import { useEffect, useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';

import { useRewardStore } from '@/store/rewardStore';

const AUTO_DISMISS_MS = 2600;

export function GoldBarCelebration() {
  const celebration = useRewardStore((state) => state.celebration);
  const dismiss = useRewardStore((state) => state.dismissCelebration);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!celebration) return;

    progress.setValue(0);
    Animated.sequence([
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.delay(AUTO_DISMISS_MS - 400),
      Animated.timing(progress, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) dismiss();
    });
  }, [celebration, progress, dismiss]);

  if (!celebration) return null;

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-x-0 top-16 items-center px-6"
      style={{
        opacity: progress,
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
        ],
      }}
    >
      <Animated.View className="flex-row items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400 px-5 py-3 shadow-2xl shadow-amber-500/40">
        <Text className="text-base">🪙</Text>
        <Text className="text-sm font-bold text-amber-950">
          +{celebration.amount} Goldbarren verdient!
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
