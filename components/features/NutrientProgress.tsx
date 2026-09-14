import { Text, View } from 'react-native';

import { NUTRIENT_META } from '@/components/features/nutrientMeta';
import type { NutrientKey } from '@/types';

/**
 * Shared by the dashboard (app/(tabs)/index.tsx) and the read-only friend
 * diary view (components/features/FriendProfileModal.tsx) so both render a
 * friend's and the caller's own macro/micronutrient progress identically -
 * one component to restyle instead of two drifting copies.
 */
export function MacroBadge({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="flex-1 gap-2 rounded-2xl bg-white/5 p-3">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={14} />
        <Text className="text-xs font-medium text-text-secondary">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-white">
        {Math.round(amount)}
        {unit}
        <Text className="text-xs font-normal text-text-secondary"> /{Math.round(goal)}{unit}</Text>
      </Text>
      <View className="h-1.5 w-full rounded-full bg-white/10">
        <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function NutrientTile({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="basis-[30%] gap-2">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={14} />
        <Text className="text-xs font-medium text-text-secondary">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-white">
        {Math.round(amount)}
        {unit} <Text className="text-xs font-normal text-text-secondary">/ {Math.round(goal)}{unit}</Text>
      </Text>
      <View className="h-1.5 w-full rounded-full bg-white/10">
        <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}
