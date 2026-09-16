import { router } from 'expo-router';
import { Camera, Moon, Plus, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiRecommendationCard } from '@/components/features/AiRecommendationCard';
import { DayDetailModal } from '@/components/features/DayDetailModal';
import { DeficitAnalyzerCard } from '@/components/features/DeficitAnalyzerCard';
import { getMealIcon, MEAL_TYPES, MEAL_TYPE_META } from '@/components/features/mealMeta';
import { ExtraNutrientsSection, MacroBadge } from '@/components/features/NutrientProgress';
import { NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { Header } from '@/components/Header';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { CYCLE_TYPE_META, getEffectiveDailyTargets } from '@/services/cycleEngine';
import { getDietTargetSummary, getMicronutrientGoalsForDiet } from '@/services/dietEngine';
import { useCycleStore } from '@/store/cycleStore';
import { useDiaryStore } from '@/store/diaryStore';
import { useRewardStore } from '@/store/rewardStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { Macros, MealEntry, MealType, NutrientKey } from '@/types';
import { getLastUpdatedLabel } from '@/utils/lastUpdated';

// Re-renders the relative "vor X Min." label periodically so it doesn't go
// stale while the screen stays mounted.
const RELATIVE_TIME_REFRESH_MS = 60_000;

const ACCENT = '#6366F1';
const OVER_LIMIT_ACCENT = '#F59E0B';
const RING_SIZE = 176;
const RING_STROKE = 16;
const EMPTY_ENTRIES: MealEntry[] = [];
const CORE_MACROS: NutrientKey[] = ['protein', 'carbs', 'fat'];

function MealCard({ mealType, entries }: { mealType: MealType; entries: MealEntry[] }) {
  const { label } = MEAL_TYPE_META[mealType];
  const activeIconPack = useRewardStore((state) => state.activeIconPack);
  const Icon = getMealIcon(mealType, activeIconPack);
  const kcal = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const protein = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-[28px] border border-surface-border bg-surface p-4 shadow-xl shadow-black/20 backdrop-blur-xl active:opacity-90"
      onPress={() => router.push({ pathname: '/meal-detail', params: { mealType } })}
      accessibilityRole="button"
      accessibilityLabel={`${label} Details öffnen`}
    >
      <View className="flex-1 flex-row items-center gap-3">
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
      <View className="flex-row items-center gap-2">
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80 active:bg-primary/20"
          onPress={() => router.push({ pathname: '/meal-parser', params: { mealType } })}
          accessibilityLabel="Per KI erfassen"
        >
          <Sparkles color={ACCENT} size={16} />
        </Pressable>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80 active:bg-primary/20"
          onPress={() => router.push({ pathname: '/analyze-food', params: { mealType } })}
          accessibilityLabel="Per Foto erfassen"
        >
          <Camera color={ACCENT} size={16} />
        </Pressable>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/30 active:opacity-90 active:bg-[#4F46E5]"
          onPress={() => router.push({ pathname: '/add-food', params: { mealType } })}
          accessibilityLabel={`Zu ${label} hinzufügen`}
        >
          <Plus color="#ffffff" size={16} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function DiaryScreen() {
  const date = useUiStore((state) => state.selectedDate);
  const entries = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES);
  const user = useUserStore((state) => state.user);
  const cycles = useCycleStore((state) => state.cycles);

  const [, forceRelativeTimeRefresh] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRelativeTimeRefresh((n) => n + 1), RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const [detailDate, setDetailDate] = useState<string | null>(null);
  const dietTargetSummary = getDietTargetSummary(user.dietType ?? 'balanced');

  // Sums 30 nutrient fields per entry and regroups by meal type - re-deriving this on
  // every render (e.g. while the sync-status indicator ticks) would repeat that work
  // without `entries` or `user` actually having changed, which is where scroll-time
  // jank on this always-mounted screen tends to come from.
  const {
    entriesByMealType,
    totalCalories,
    nutrientAmounts,
    nutrientGoals,
    secondaryNutrients,
    remainingCalories,
    isOverLimit,
    surplusCalories,
    caloriePct,
    remainingMacros,
    calorieGoal,
    activeCycle,
    targetsSuppressed,
  } = useMemo(() => {
    const grouped: Record<MealType, MealEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
    for (const entry of entries) {
      grouped[entry.mealType].push(entry);
    }

    const { cycle, targetsSuppressed, calorieGoal, macroGoal } = getEffectiveDailyTargets(user, cycles, date);

    const totalCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
    const nutrientAmounts = sumEntryNutrients(entries);
    const totalMacros: Macros = { carbs: nutrientAmounts.carbs, protein: nutrientAmounts.protein, fat: nutrientAmounts.fat };
    const nutrientGoals: Record<NutrientKey, number> = {
      ...macroGoal,
      ...getMicronutrientGoalsForDiet(user.dietType ?? 'balanced', user.gender),
    };
    const secondaryNutrients = NUTRIENT_ORDER.filter(
      (key) => user.visibleNutrients[key] && !CORE_MACROS.includes(key),
    );

    const remainingCalories = Math.round(Math.max(calorieGoal - totalCalories, 0));
    const isOverLimit = calorieGoal > 0 && totalCalories > calorieGoal;
    const surplusCalories = Math.round(Math.max(totalCalories - calorieGoal, 0));
    const caloriePct = calorieGoal > 0 ? totalCalories / calorieGoal : 0;
    const remainingMacros: Macros = {
      carbs: Math.max(macroGoal.carbs - totalMacros.carbs, 0),
      protein: Math.max(macroGoal.protein - totalMacros.protein, 0),
      fat: Math.max(macroGoal.fat - totalMacros.fat, 0),
    };

    return {
      entriesByMealType: grouped,
      totalCalories,
      nutrientAmounts,
      nutrientGoals,
      secondaryNutrients,
      remainingCalories,
      isOverLimit,
      surplusCalories,
      caloriePct,
      remainingMacros,
      calorieGoal,
      activeCycle: cycle,
      targetsSuppressed,
    };
  }, [entries, user, cycles, date]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header onDaySelected={setDetailDate} />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:px-10 lg:pb-12">
        <View className="gap-6 lg:flex-row lg:items-start">
          <View className="gap-6 lg:w-[380px] lg:shrink-0">
            <View className="items-center gap-5 rounded-[28px] border border-surface-border bg-surface p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl">
              {targetsSuppressed ? (
                <View className="items-center gap-3 py-4">
                  <View
                    className="flex-row items-center gap-2 rounded-full px-4 py-2"
                    style={{ backgroundColor: `${CYCLE_TYPE_META[activeCycle?.type ?? 'cheat'].color}26` }}
                  >
                    <Moon color={CYCLE_TYPE_META[activeCycle?.type ?? 'cheat'].color} size={16} />
                    <Text className="text-sm font-bold" style={{ color: CYCLE_TYPE_META[activeCycle?.type ?? 'cheat'].color }}>
                      Cheat / Break Period
                    </Text>
                  </View>
                  <Text className="text-xs text-text-secondary">{activeCycle?.name}</Text>
                  <Text className="text-3xl font-bold tracking-tight text-white">{Math.round(totalCalories)} kcal</Text>
                  <Text className="text-xs text-text-secondary">Tagesziel für diesen Zeitraum ausgesetzt</Text>
                </View>
              ) : (
                <>
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
                  {activeCycle ? (
                    <Text className="text-[11px]" style={{ color: CYCLE_TYPE_META[activeCycle.type].color }}>
                      {CYCLE_TYPE_META[activeCycle.type].label}: {activeCycle.name}
                    </Text>
                  ) : (
                    dietTargetSummary && <Text className="text-[11px] text-text-secondary">{dietTargetSummary}</Text>
                  )}

                  <ExtraNutrientsSection nutrientKeys={secondaryNutrients} amounts={nutrientAmounts} goals={nutrientGoals} />
                </>
              )}
            </View>

            {!targetsSuppressed && (
              <View className="gap-3 rounded-[28px]">
                <Text className="px-1 text-sm font-semibold text-text-secondary">Für dich</Text>
                <AiRecommendationCard
                  remainingCalories={remainingCalories}
                  remainingMacros={remainingMacros}
                  visibleNutrients={user.visibleNutrients}
                />
              </View>
            )}
          </View>

          <View className="flex-1 gap-3">
            <Text className="text-sm font-semibold text-text-secondary">Mahlzeiten</Text>
            <View className="gap-4">
              {MEAL_TYPES.map((mealType) => (
                <MealCard key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
              ))}
            </View>
          </View>
        </View>

        <DeficitAnalyzerCard />

        <Text className="mb-6 self-start rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] text-text-secondary">
          App-Build: {getLastUpdatedLabel()} Uhr
        </Text>
      </ScrollView>

      <DayDetailModal date={detailDate} onClose={() => setDetailDate(null)} />
    </SafeAreaView>
  );
}
