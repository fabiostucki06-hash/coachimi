import { router } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { useCoinAnchorStore } from '@/store/coinAnchorStore';
import { useRewardStore } from '@/store/rewardStore';
import { BADGE_COUNT_UP_MS, COIN_ARRIVAL_MS } from '@/utils/coinAnimation';

interface GoldBarBadgeProps {
  /** Shrinks padding/text/icon for narrow viewports (< 380px) so the header row fits on one line. */
  compact?: boolean;
}

export function GoldBarBadge({ compact = false }: GoldBarBadgeProps = {}) {
  const goldBars = useRewardStore((state) => state.goldBars);
  const celebration = useRewardStore((state) => state.celebration);
  const setAnchor = useCoinAnchorStore((state) => state.setAnchor);

  const containerRef = useRef<View>(null);
  const prevGoldBars = useRef(goldBars);
  const lastCelebrationId = useRef<number | null>(null);
  const [displayValue, setDisplayValue] = useState(goldBars);

  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  function measureAnchor() {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      if (width === 0 && height === 0) return;
      setAnchor({ x: x + width / 2, y: y + height / 2 });
    });
  }

  useEffect(() => {
    measureAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!celebration || celebration.amount <= 0 || celebration.id === lastCelebrationId.current) {
      if (!celebration) {
        setDisplayValue(goldBars);
        prevGoldBars.current = goldBars;
      }
      return;
    }
    lastCelebrationId.current = celebration.id;
    measureAnchor();

    scale.value = withDelay(
      COIN_ARRIVAL_MS,
      withSequence(
        withTiming(1.18, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.8)) }),
      ),
    );
    glow.value = withDelay(COIN_ARRIVAL_MS, withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 550 })));

    const start = prevGoldBars.current;
    const end = goldBars;
    const startedAt = Date.now() + COIN_ARRIVAL_MS;
    let raf: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / BADGE_COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevGoldBars.current = end;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [celebration, goldBars, scale, glow]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 1 + glow.value * 0.4 }] }));

  return (
    <View ref={containerRef} collapsable={false} className="relative" onLayout={measureAnchor}>
      <Animated.View pointerEvents="none" className="absolute -inset-2 rounded-full bg-amber-400/30" style={glowStyle} />
      <Animated.View style={badgeStyle}>
        <Pressable
          className={`${compact ? 'h-8 gap-1 px-2' : 'h-9 gap-1.5 px-3'} flex-row items-center rounded-full border border-amber-400/40 bg-amber-400/15 transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80`}
          onPress={() => router.push('/rewards')}
          accessibilityLabel={`${goldBars} Goldbarren – Belohnungen öffnen`}
        >
          <Coins color="#d97706" size={compact ? 12 : 14} />
          <Text className={`${compact ? 'text-xs' : 'text-sm'} font-bold tracking-tight text-amber-600 dark:text-amber-400`}>
            {displayValue}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
