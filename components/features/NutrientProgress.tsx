import { Text, View } from 'react-native';

import { NUTRIENT_CATEGORY_LABELS, NUTRIENT_CATEGORY_ORDER, NUTRIENT_META } from '@/components/features/nutrientMeta';
import type { NutrientKey } from '@/types';

/**
 * Shared by the dashboard (app/(tabs)/index.tsx) and the read-only friend
 * diary view (components/features/FriendProfileModal.tsx) so both render a
 * friend's and the caller's own macro/micronutrient progress identically -
 * one component to restyle instead of two drifting copies.
 */
export function MacroBadge({
  nutrientKey,
  amount,
  goal,
  className = 'flex-1',
}: {
  nutrientKey: NutrientKey;
  amount: number;
  goal: number;
  /** Outer sizing only - defaults to the equal-width `flex-1` the 3-across core macro row needs. ExtraNutrientsSection below passes a `basis` instead so the identical card can also sit in a wrapping grid. */
  className?: string;
}) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className={`${className} gap-2 rounded-2xl bg-white/5 p-3`}>
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

/**
 * "Show Extra Macros/Micros" - the user-toggled secondary nutrients
 * (NutrientVisibilitySelector), rendered as more of the exact same MacroBadge
 * card the core Protein/Carbs/Fat row above already uses (same rounded-2xl
 * bg-white/5 card, progress bar, and typography), grouped by category into
 * more `border-t` divider rows continuing that same hero card - not a
 * separate bordered/blurred card of its own, so it reads as native rows of
 * the existing dashboard card rather than a bolted-on secondary section.
 * Renders as sibling rows (a Fragment), so the caller places it directly
 * inside the same hero card as the core macro row. Shared by the dashboard
 * and the read-only friend diary view so both render this section identically.
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

  return (
    <>
      {groups.map(({ category, keys }) => (
        <View key={category} className="w-full gap-3 border-t border-surface-border pt-5">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {NUTRIENT_CATEGORY_LABELS[category]}
          </Text>
          <View className="w-full flex-row flex-wrap gap-3">
            {keys.map((key) => (
              <MacroBadge key={key} nutrientKey={key} amount={amounts[key]} goal={goals[key]} className="grow basis-[47%]" />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}
