import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ParticleRing } from '@/components/ui/particleBurst';
import { useRewardStore } from '@/store/rewardStore';
import { triggerCoinHaptic } from '@/utils/haptics';

const ICON_SIZE = 44;
const VISIBLE_MS = 1700;
const PARTICLE_COLORS = ['#6366F1', '#d97706'];

/** Center-screen "unlocked" burst shown after a Coin Shop purchase - the spend-side counterpart to GoldBarCelebration's earn-side coin flight. */
export function PurchaseCelebration() {
  const purchaseCelebration = useRewardStore((state) => state.purchaseCelebration);
  const dismiss = useRewardStore((state) => state.dismissPurchaseCelebration);

  const [active, setActive] = useState(purchaseCelebration);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (!purchaseCelebration) return;
    setActive(purchaseCelebration);
    triggerCoinHaptic().catch(() => {});

    opacity.value = 0;
    scale.value = 0.85;
    opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) });

    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      scale.value = withTiming(0.92, { duration: 220, easing: Easing.in(Easing.quad) });
    }, VISIBLE_MS - 240);

    const clearTimer = setTimeout(() => {
      dismiss();
      setActive(null);
    }, VISIBLE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [purchaseCelebration, opacity, scale, dismiss]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!active) return null;

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <Animated.View style={style} className="max-w-[280px] items-center gap-3 rounded-[28px] border border-primary/30 bg-surface/95 px-6 py-6 shadow-2xl shadow-primary/20">
        <View className="relative h-11 w-11 items-center justify-center">
          <ParticleRing iconSize={ICON_SIZE} colors={PARTICLE_COLORS} />
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/15">
            <Sparkles color="#818CF8" size={20} />
          </View>
        </View>
        <View className="items-center gap-0.5">
          <Text className="text-sm font-bold tracking-tight text-primary">Freigeschaltet</Text>
          <Text className="text-center text-sm text-foreground" numberOfLines={2}>
            {active.itemName}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
