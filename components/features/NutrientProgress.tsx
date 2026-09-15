import { Text, View } from 'react-native';

import { NUTRIENT_CATEGORY_LABELS, NUTRIENT_CATEGORY_ORDER, NUTRIENT_META } from '@/components/features/nutrientMeta';
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

/**
 * "Show Extra Macros/Micros" ("weitere Nährwerte") section - the user-toggled
 * secondary nutrients (NutrientVisibilitySelector), grouped by category into
 * their own Monochrome Minimal cards rather than one flex-wrap row crammed
 * into the calorie hero card. Shared by the dashboard and the read-only
 * friend diary view so both render this section identically.
 */
export function ExtraNutrientsSection({
  nutrientKeys,
  amounts,
  goals,
}: {
  nutrientKeys: NutrientKey[];
  amounts: Record<NutrientKey, number>;
  goals: Record<NutrientKey, number>;
}) {
  const groups = NUTRIENT_CATEGORY_ORDER.map((category) => ({
    category,
    keys: nutrientKeys.filter((key) => NUTRIENT_META[key].category === category),
  })).filter((group) => group.keys.length > 0);

  if (groups.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="px-1 text-sm font-semibold text-text-secondary">Weitere Nährwerte</Text>
      <View className="gap-3">
        {groups.map(({ category, keys }) => (
          <View
            key={category}
            className="gap-4 rounded-[28px] border border-surface-border bg-surface p-4 shadow-xl shadow-black/20 backdrop-blur-xl"
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {NUTRIENT_CATEGORY_LABELS[category]}
            </Text>
            <View className="flex-row flex-wrap gap-x-4 gap-y-4">
              {keys.map((key) => (
                <NutrientTile key={key} nutrientKey={key} amount={amounts[key]} goal={goals[key]} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
