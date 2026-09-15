import { Coins } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useCoinAnchorStore } from '@/store/coinAnchorStore';
import { useRewardStore } from '@/store/rewardStore';
import { CELEBRATION_VISIBLE_MS, COIN_BURST_MS, COIN_FLIGHT_MS } from '@/utils/coinAnimation';
import { triggerCoinHaptic } from '@/utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ICON_SIZE = 44;
const RING_SIZE = 96;
const PARTICLE_COUNT = 8;
const FLYING_COIN_COUNT = 3;
const PARTICLE_COLORS = ['#f59e0b', '#6366F1'];

function RingBurst() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const outerProps = useAnimatedProps(() => ({
    r: 14 + progress.value * 32,
    opacity: (1 - progress.value) * 0.5,
  }));
  const innerProps = useAnimatedProps(() => ({
    r: 10 + progress.value * 20,
    opacity: (1 - progress.value) * 0.7,
  }));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -(RING_SIZE - ICON_SIZE) / 2, left: -(RING_SIZE - ICON_SIZE) / 2 }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <AnimatedCircle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={14} stroke="#6366F1" strokeWidth={2} fill="none" animatedProps={outerProps} />
        <AnimatedCircle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={10} stroke="#f59e0b" strokeWidth={2} fill="none" animatedProps={innerProps} />
      </Svg>
    </View>
  );
}

function Particle({ angle, color, delay }: { angle: number; color: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [progress, delay]);

  const style = useAnimatedStyle(() => {
    const distance = 22 + progress.value * 26;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: Math.cos(angle) * distance },
        { translateY: Math.sin(angle) * distance },
        { scale: 1 - progress.value * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: ICON_SIZE / 2 - 3, left: ICON_SIZE / 2 - 3, width: 6, height: 6, borderRadius: 999, backgroundColor: color },
        style,
      ]}
    />
  );
}

function FlyingCoin({ origin, target, delay }: { origin: { x: number; y: number }; target: { x: number; y: number }; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: COIN_FLIGHT_MS, easing: Easing.in(Easing.cubic) }));
  }, [progress, delay]);

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const arc = -60 * Math.sin(t * Math.PI);
    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = 1 - Math.max(0, t - 0.72) / 0.28;
    return {
      opacity: Math.min(fadeIn, fadeOut),
      transform: [{ translateX: dx * t }, { translateY: dy * t + arc }, { scale: 1 - t * 0.4 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: origin.x - 9, top: origin.y - 9 }, style]}>
      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-amber-400 shadow-lg shadow-amber-500/50">
        <Coins color="#78350f" size={11} />
      </View>
    </Animated.View>
  );
}

export function GoldBarCelebration() {
  const celebration = useRewardStore((state) => state.celebration);
  const dismiss = useRewardStore((state) => state.dismissCelebration);
  const anchor = useCoinAnchorStore((state) => state.anchor);

  const [activeCelebration, setActiveCelebration] = useState(celebration);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const iconRef = useRef<View>(null);

  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(-16);
  const cardScale = useSharedValue(0.9);

  useEffect(() => {
    if (!celebration) return;
    setActiveCelebration(celebration);
    setOrigin(null);
    triggerCoinHaptic().catch(() => {});

    cardOpacity.value = 0;
    cardTranslateY.value = -16;
    cardScale.value = 0.9;
    cardOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    cardTranslateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.back(1.4)) });
    cardScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) });

    const measureRaf = requestAnimationFrame(() => {
      iconRef.current?.measureInWindow((x, y, width, height) => {
        setOrigin({ x: x + width / 2, y: y + height / 2 });
      });
    });

    const fadeTimer = setTimeout(() => {
      cardOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      cardTranslateY.value = withTiming(-10, { duration: 220, easing: Easing.in(Easing.quad) });
    }, CELEBRATION_VISIBLE_MS - 240);

    const clearTimer = setTimeout(() => {
      dismiss();
      setActiveCelebration(null);
      setOrigin(null);
    }, CELEBRATION_VISIBLE_MS);

    return () => {
      cancelAnimationFrame(measureRaf);
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [celebration, cardOpacity, cardTranslateY, cardScale, dismiss]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }, { scale: cardScale.value }],
  }));

  if (!activeCelebration) return null;

  const fallback = { x: Dimensions.get('window').width - 46, y: 56 };
  const target = anchor ?? fallback;
  const particleAngles = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2);

  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Animated.View className="absolute inset-x-0 top-16 items-center px-6" style={cardStyle}>
        <View className="max-w-xs flex-row items-center gap-3 rounded-2xl border border-amber-400/30 bg-surface/95 px-4 py-3.5 shadow-2xl shadow-amber-500/20">
          <View key={activeCelebration.id} ref={iconRef} collapsable={false} className="relative h-11 w-11 items-center justify-center">
            <RingBurst />
            {particleAngles.map((angle, i) => (
              <Particle key={i} angle={angle} delay={i * 14} color={PARTICLE_COLORS[i % PARTICLE_COLORS.length]} />
            ))}
            <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-400/15">
              <Coins color="#d97706" size={20} />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold tracking-tight text-amber-400">+{activeCelebration.amount} Goldbarren</Text>
            <Text className="text-xs text-text-secondary" numberOfLines={1}>
              {activeCelebration.reason}
            </Text>
          </View>
        </View>
      </Animated.View>

      {origin &&
        Array.from({ length: FLYING_COIN_COUNT }, (_, i) => (
          <FlyingCoin key={`${activeCelebration.id}-${i}`} origin={origin} target={target} delay={COIN_BURST_MS + i * 70} />
        ))}
    </View>
  );
}
