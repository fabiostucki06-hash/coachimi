import { Clock, Droplet, RotateCw, Sparkles } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import type { Macros, NutrientVisibility } from '@/types';
import { generateRecommendation, getTimeOfDay, type TipMode } from '@/utils/recommendationEngine';

const MODE_ICONS: Record<TipMode, typeof Sparkles> = {
  food: Sparkles,
  timing: Clock,
  hydration: Droplet,
};

interface AiRecommendationCardProps {
  remainingCalories: number;
  remainingMacros: Macros;
  visibleNutrients: NutrientVisibility;
}

export function AiRecommendationCard({ remainingCalories, remainingMacros, visibleNutrients }: AiRecommendationCardProps) {
  const [variantIndex, setVariantIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;

  const visibleMacros = useMemo(
    () => ({ protein: visibleNutrients.protein, carbs: visibleNutrients.carbs, fat: visibleNutrients.fat }),
    [visibleNutrients.protein, visibleNutrients.carbs, visibleNutrients.fat],
  );

  const recommendation = useMemo(
    () => generateRecommendation(getTimeOfDay(), remainingCalories, remainingMacros, visibleMacros, variantIndex),
    [remainingCalories, remainingMacros, visibleMacros, variantIndex],
  );

  function handleReload() {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const variantCount = recommendation.variantCount;
    setVariantIndex((current) => {
      if (variantCount <= 1) return current;
      let next = current;
      while (next === current) {
        next = Math.floor(Math.random() * variantCount);
      }
      return next;
    });
  }

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ModeIcon = MODE_ICONS[recommendation.mode];

  return (
    <View className="gap-3 rounded-[28px] border border-white/20 bg-emerald-500/90 p-4 shadow-2xl shadow-emerald-500/30 backdrop-blur-xl">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
          <ModeIcon color="#ffffff" size={18} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
            {recommendation.timeLabel} · {recommendation.modeLabel}
          </Text>
          <Text className="text-sm font-bold tracking-tight text-white">{recommendation.headline}</Text>
        </View>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-white/10 active:opacity-70"
          onPress={handleReload}
          accessibilityLabel="Anderen Tipp anzeigen"
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <RotateCw color="#ffffff" size={15} />
          </Animated.View>
        </Pressable>
      </View>
      <Text className="text-sm leading-5 text-white/90">{recommendation.suggestion}</Text>
    </View>
  );
}
