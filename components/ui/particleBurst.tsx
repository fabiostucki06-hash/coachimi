import { useEffect } from 'react';
import { View } from 'react-native';
import { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const PARTICLE_COUNT = 8;
export const DEFAULT_PARTICLE_COLORS = ['#f59e0b', '#6366F1'];

/** Two-ring pulse that expands and fades outward from its container's center - shared by GoldBarCelebration (earning) and PurchaseCelebration (spending). */
export function RingBurst({ size, outerColor = '#6366F1', innerColor = '#f59e0b' }: { size: number; outerColor?: string; innerColor?: string }) {
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
    <View pointerEvents="none" style={{ position: 'absolute', top: -(size - 44) / 2, left: -(size - 44) / 2 }}>
      <Svg width={size} height={size}>
        <AnimatedCircle cx={size / 2} cy={size / 2} r={14} stroke={outerColor} strokeWidth={2} fill="none" animatedProps={outerProps} />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={10} stroke={innerColor} strokeWidth={2} fill="none" animatedProps={innerProps} />
      </Svg>
    </View>
  );
}

/** One dot flying outward from its container's center along `angle`, fading out as it travels. */
export function Particle({ angle, color, delay, originOffset }: { angle: number; color: string; delay: number; originOffset: number }) {
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
        { position: 'absolute', top: originOffset - 3, left: originOffset - 3, width: 6, height: 6, borderRadius: 999, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function ParticleRing({ iconSize, colors = DEFAULT_PARTICLE_COLORS }: { iconSize: number; colors?: string[] }) {
  const angles = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2);
  return (
    <>
      <RingBurst size={iconSize + 52} outerColor={colors[1] ?? colors[0]} innerColor={colors[0]} />
      {angles.map((angle, i) => (
        <Particle key={i} angle={angle} delay={i * 14} color={colors[i % colors.length]} originOffset={iconSize / 2} />
      ))}
    </>
  );
}
