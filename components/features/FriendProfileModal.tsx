import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MEAL_TYPES, MEAL_TYPE_META } from '@/components/features/mealMeta';
import { ExtraNutrientsSection, MacroBadge } from '@/components/features/NutrientProgress';
import { NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { fetchFriendSnapshot, formatFriendLabel, type FriendProfile } from '@/services/friends';
import { useToastStore } from '@/store/toastStore';
import type { CloudSnapshot } from '@/services/cloudSync';
import type { MealEntry, MealType, NutrientKey } from '@/types';
import { addDays, getLocalDateKey } from '@/utils/calendarDates';
import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

// Same constants the dashboard (app/(tabs)/index.tsx) uses for its hero ring
// and macro row, kept in lockstep on purpose so a friend's diary renders as
// the exact same visual language as the caller's own, not a lookalike.
const ACCENT = '#6366F1';
const OVER_LIMIT_ACCENT = '#F59E0B';
const RING_SIZE = 176;
const RING_STROKE = 16;
const CORE_MACROS: NutrientKey[] = ['protein', 'carbs', 'fat'];
const EMPTY_ENTRIES: MealEntry[] = [];

/**
 * Same visual shape as the dashboard's MealCard (icon bubble, rounded-[28px]
 * card, kcal/protein summary line) plus the itemized entry list, but with
 * every interactive affordance removed - no Sparkles/Camera/Plus buttons, no
 * onPress navigation into a detail screen. Purely a list of what the friend
 * logged.
 */
function FriendMealCard({ mealType, entries }: { mealType: MealType; entries: MealEntry[] }) {
  const { label, Icon } = MEAL_TYPE_META[mealType];
  const kcal = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const protein = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);

  return (
    <View className="gap-3 rounded-[28px] border border-surface-border bg-surface p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon color={ACCENT} size={18} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold tracking-tight text-white">{label}</Text>
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            {entries.length > 0 ? `${Math.round(kcal)} kcal · ${Math.round(protein)}g P` : 'Noch keine Einträge'}
          </Text>
        </View>
      </View>

      {entries.length > 0 && (
        <View className="gap-2 border-t border-surface-border pt-3">
          {entries.map((entry) => (
            <View key={entry.id} className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm text-white" numberOfLines={1}>
                  {entry.foodItem.name}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {entry.servings}× {entry.foodItem.servingSize}{entry.foodItem.servingUnit}
                </Text>
              </View>
              <Text className="text-sm text-text-secondary">{Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface FriendProfileModalProps {
  /** Friend to show, or null to keep the modal closed. */
  friend: FriendProfile | null;
  onClose: () => void;
}

/**
 * Read-only day view of a friend's log, deliberately built from the same
 * pieces as the dashboard (ProgressRing, MacroBadge/NutrientTile from
 * components/features/NutrientProgress, the same rounded-[28px]/OLED-black/
 * indigo card language) instead of a simplified lookalike, so it reads as
 * "your own diary, someone else's data" rather than a separate feature.
 * Sourced from the friend's synced snapshot (services/friends.ts
 * fetchFriendSnapshot, gated by the "Accepted friends can read" RLS policy -
 * see supabase/migrations/0001_friends_readonly_access.sql) instead of the
 * local diaryStore. No edit/delete/add-entry affordance exists anywhere in
 * this component on purpose - it must stay impossible to mutate another
 * user's data from here, not just hidden behind a permission check.
 */
export function FriendProfileModal({ friend, onClose }: FriendProfileModalProps) {
  const showToast = useToastStore((state) => state.show);
  const [snapshot, setSnapshot] = useState<CloudSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateKey, setDateKey] = useState(getLocalDateKey());

  useEffect(() => {
    if (!friend) return;
    setDateKey(getLocalDateKey());
  }, [friend]);

  useEffect(() => {
    if (!friend) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchFriendSnapshot(friend.id)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((err) => {
        if (!cancelled) showToast(err instanceof Error ? err.message : 'Profil konnte nicht geladen werden');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friend, showToast]);

  const entries = snapshot?.entriesByDate?.[dateKey] ?? EMPTY_ENTRIES;
  const friendUser = snapshot?.user;

  // Mirrors the dashboard's own useMemo block exactly (same sumEntryNutrients/
  // NUTRIENT_ORDER helpers, same remaining/percent math) so a friend's ring
  // and badges land on identical numbers for identical underlying data.
  const { entriesByMealType, totalCalories, nutrientAmounts, nutrientGoals, secondaryNutrients, remainingCalories, isOverLimit, surplusCalories, caloriePct } = useMemo(() => {
    const grouped: Record<MealType, MealEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
    for (const entry of entries) {
      grouped[entry.mealType].push(entry);
    }

    const totalCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
    const nutrientAmounts = sumEntryNutrients(entries);
    const nutrientGoals: Record<NutrientKey, number> = { ...(friendUser?.dailyMacroGoal ?? { carbs: 0, protein: 0, fat: 0 }), ...MICRONUTRIENT_GOALS };
    const visibleNutrients = friendUser?.visibleNutrients;
    const secondaryNutrients = visibleNutrients
      ? NUTRIENT_ORDER.filter((key) => visibleNutrients[key] && !CORE_MACROS.includes(key))
      : [];

    const calorieGoal = friendUser?.dailyCalorieGoal ?? 0;
    const remainingCalories = Math.round(Math.max(calorieGoal - totalCalories, 0));
    const isOverLimit = calorieGoal > 0 && totalCalories > calorieGoal;
    const surplusCalories = Math.round(Math.max(totalCalories - calorieGoal, 0));
    const caloriePct = calorieGoal > 0 ? totalCalories / calorieGoal : 0;

    return { entriesByMealType: grouped, totalCalories, nutrientAmounts, nutrientGoals, secondaryNutrients, remainingCalories, isOverLimit, surplusCalories, caloriePct };
  }, [entries, friendUser]);

  const calorieGoal = friendUser?.dailyCalorieGoal ?? 0;
  const isToday = dateKey === getLocalDateKey();
  const friendLabel = friend ? formatFriendLabel(friend) : '';

  const dateLabel = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <Modal visible={friend !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-surface/50" onPress={onClose}>
        <Pressable className="max-h-[90%] gap-5 rounded-t-[32px] bg-background px-6 pb-8 pt-5" onPress={(e) => e.stopPropagation()}>
          <View className="items-center">
            <View className="h-1.5 w-10 rounded-full bg-white/20" />
          </View>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-primary" numberOfLines={1}>
                {friendLabel}
              </Text>
              <Text className="text-2xl font-bold tracking-tight text-white">Tagebuch</Text>
              <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1">
                <Lock color={ACCENT} size={12} />
                <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                  {friendLabel} • Nur Lesen
                </Text>
              </View>
            </View>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-80"
              onPress={onClose}
              accessibilityLabel="Schliessen"
            >
              <X color="#A1A1AA" size={18} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#6366F1" />
          ) : !snapshot ? (
            <Text className="py-8 text-center text-sm text-text-secondary">Keine geteilten Daten verfügbar.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-6 pb-4">
              <View className="flex-row items-center justify-between">
                <Pressable
                  accessibilityLabel="Vorheriger Tag"
                  className="h-9 w-9 items-center justify-center rounded-full active:bg-white/5"
                  onPress={() => setDateKey((key) => addDays(key, -1))}
                >
                  <ChevronLeft color="#A1A1AA" size={18} />
                </Pressable>
                <Text className="text-sm font-semibold text-white">{dateLabel}</Text>
                <Pressable
                  accessibilityLabel="Nächster Tag"
                  disabled={isToday}
                  className={`h-9 w-9 items-center justify-center rounded-full active:bg-white/5 ${isToday ? 'opacity-30' : ''}`}
                  onPress={() => setDateKey((key) => addDays(key, 1))}
                >
                  <ChevronRight color="#A1A1AA" size={18} />
                </Pressable>
              </View>

              {/* Same card as the dashboard's hero: rounded-[28px] OLED surface,
                  ProgressRing, core macro badges, then secondary nutrient tiles -
                  identical structure and components, only the data source differs. */}
              <View className="items-center gap-5 rounded-[28px] border border-surface-border bg-surface p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl">
                <View className="items-center gap-1">
                  <ProgressRing size={RING_SIZE} strokeWidth={RING_STROKE} progress={caloriePct} color={isOverLimit ? OVER_LIMIT_ACCENT : ACCENT}>
                    <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {isOverLimit ? 'Über Ziel' : 'Verbleibend'}
                    </Text>
                    <Text className={`text-3xl font-bold tracking-tight ${isOverLimit ? 'text-amber-500' : 'text-white'}`}>
                      {isOverLimit ? `+${surplusCalories}` : remainingCalories}
                    </Text>
                    <Text className="text-xs text-text-secondary">von {calorieGoal} kcal</Text>
                  </ProgressRing>
                  {isOverLimit ? (
                    <View className="flex-row items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1">
                      <Text className="text-sm font-semibold text-amber-500">
                        +{surplusCalories} kcal über Limit
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-base font-semibold text-primary">
                      {Math.round(totalCalories)} kcal gegessen
                    </Text>
                  )}
                </View>

                <View className="w-full flex-row gap-3 border-t border-surface-border pt-5">
                  {CORE_MACROS.map((key) => (
                    <MacroBadge key={key} nutrientKey={key} amount={nutrientAmounts[key]} goal={nutrientGoals[key]} />
                  ))}
                </View>
              </View>

              <ExtraNutrientsSection nutrientKeys={secondaryNutrients} amounts={nutrientAmounts} goals={nutrientGoals} />

              <View className="gap-3">
                <Text className="px-1 text-sm font-semibold text-text-secondary">Mahlzeiten</Text>
                <View className="gap-4">
                  {MEAL_TYPES.map((mealType) => (
                    <FriendMealCard key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
                  ))}
                </View>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
