import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      className={`rounded-2xl bg-overlay/10 ${className}`}
      style={{ opacity: pulse }}
    />
  );
}

export function SkeletonListRow() {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface px-4 py-3 backdrop-blur-xl">
      <View className="flex-1 gap-2 pr-3">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </View>
      <Skeleton className="h-3.5 w-16" />
    </View>
  );
}
