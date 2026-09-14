import { router } from 'expo-router';
import { Camera, Plus, RefreshCw, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiRecommendationCard } from '@/components/features/AiRecommendationCard';
import { DateSelector } from '@/components/features/DateSelector';
import { DayDetailModal } from '@/components/features/DayDetailModal';
import { DeficitAnalyzerCard } from '@/components/features/DeficitAnalyzerCard';
import { MEAL_TYPES, MEAL_TYPE_META } from '@/components/features/mealMeta';
import { NUTRIENT_META, NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { GoldBarBadge } from '@/components/ui/GoldBarBadge';
import { HardRefreshButton } from '@/components/ui/HardRefreshButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useDiaryStore } from '@/store/diaryStore';
import { useSyncStore } from '@/store/syncStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { Macros, MealEntry, MealType, NutrientKey } from '@/types';
import { formatUpdatedAt } from '@/utils/formatUpdatedAt';
import { getLastUpdatedLabel } from '@/utils/lastUpdated';
import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

// Re-renders the relative "vor X Min." label periodically so it doesn't go
// stale while the screen stays mounted.
const RELATIVE_TIME_REFRESH_MS = 60_000;

const ACCENT = '#10b981';
const RING_SIZE = 176;
const RING_STROKE = 16;
const EMPTY_ENTRIES: MealEntry[] = [];
const CORE_MACROS: NutrientKey[] = ['protein', 'carbs', 'fat'];

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function MacroBadge({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="flex-1 gap-2 rounded-2xl bg-slate-100/70 p-3 dark:bg-slate-800/50">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={14} />
        <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white">
        {Math.round(amount)}
        {unit}
        <Text className="text-xs font-normal text-slate-400"> /{Math.round(goal)}{unit}</Text>
      </Text>
      <View className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
        <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function NutrientTile({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="basis-[30%] gap-2">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={14} />
        <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white">
        {Math.round(amount)}
        {unit} <Text className="text-xs font-normal text-slate-400">/ {Math.round(goal)}{unit}</Text>
      </Text>
      <View className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
        <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MealCard({ mealType, entries }: { mealType: MealType; entries: MealEntry[] }) {
  const { label, Icon } = MEAL_TYPE_META[mealType];
  const kcal = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const protein = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-[28px] border border-slate-200/60 bg-white/70 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl active:opacity-90 dark:border-slate-800/60 dark:bg-slate-900/60 dark:shadow-black/20"
      onPress={() => router.push({ pathname: '/meal-detail', params: { mealType } })}
      accessibilityRole="button"
      accessibilityLabel={`${label} Details öffnen`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
          <Icon color={ACCENT} size={18} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{label}</Text>
          <Text className="text-xs text-slate-400" numberOfLines={1}>
            {entries.length > 0 ? `${Math.round(kcal)} kcal · ${Math.round(protein)}g P` : 'Noch keine Einträge'}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 active:opacity-80 active:bg-emerald-500/20"
          onPress={() => router.push({ pathname: '/meal-parser', params: { mealType } })}
          accessibilityLabel="Per KI erfassen"
        >
          <Sparkles color={ACCENT} size={16} />
        </Pressable>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 active:opacity-80 active:bg-emerald-500/20"
          onPress={() => router.push({ pathname: '/analyze-food', params: { mealType } })}
          accessibilityLabel="Per Foto erfassen"
        >
          <Camera color={ACCENT} size={16} />
        </Pressable>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30 active:opacity-90 active:bg-emerald-600"
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
  const lastUpdatedAt = useDiaryStore((state) => state.lastUpdatedAt);
  const user = useUserStore((state) => state.user);
  const session = useSyncStore((state) => state.session);
  const syncStatus = useSyncStore((state) => state.status);
  const remoteUpdatedAt = useSyncStore((state) => state.remoteUpdatedAt);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const syncNow = useSyncStore((state) => state.syncNow);
  const syncedAt = remoteUpdatedAt ?? lastSyncedAt;

  const [, forceRelativeTimeRefresh] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRelativeTimeRefresh((n) => n + 1), RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const [detailDate, setDetailDate] = useState<string | null>(null);

  const selectedDateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  // Sums 30 nutrient fields per entry and regroups by meal type - re-deriving this on
  // every render (e.g. while the sync-status indicator ticks) would repeat that work
  // without `entries` or `user` actually having changed, which is where scroll-time
  // jank on this always-mounted screen tends to come from.
  const { entriesByMealType, totalCalories, nutrientAmounts, nutrientGoals, secondaryNutrients, remainingCalories, caloriePct, remainingMacros } = useMemo(() => {
    const grouped: Record<MealType, MealEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
    for (const entry of entries) {
      grouped[entry.mealType].push(entry);
    }

    const totalCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
    const nutrientAmounts = sumEntryNutrients(entries);
    const totalMacros: Macros = { carbs: nutrientAmounts.carbs, protein: nutrientAmounts.protein, fat: nutrientAmounts.fat };
    const nutrientGoals: Record<NutrientKey, number> = { ...user.dailyMacroGoal, ...MICRONUTRIENT_GOALS };
    const secondaryNutrients = NUTRIENT_ORDER.filter(
      (key) => user.visibleNutrients[key] && !CORE_MACROS.includes(key),
    );

    const remainingCalories = Math.round(Math.max(user.dailyCalorieGoal - totalCalories, 0));
    const caloriePct = user.dailyCalorieGoal > 0 ? totalCalories / user.dailyCalorieGoal : 0;
    const remainingMacros: Macros = {
      carbs: Math.max(user.dailyMacroGoal.carbs - totalMacros.carbs, 0),
      protein: Math.max(user.dailyMacroGoal.protein - totalMacros.protein, 0),
      fat: Math.max(user.dailyMacroGoal.fat - totalMacros.fat, 0),
    };

    return { entriesByMealType: grouped, totalCalories, nutrientAmounts, nutrientGoals, secondaryNutrients, remainingCalories, caloriePct, remainingMacros };
  }, [entries, user]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:px-10 lg:pb-12">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Coach imi</Text>
            <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Tagebuch</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400">{selectedDateLabel}</Text>
            {session && (
              <Pressable
                onPress={() => syncNow()}
                disabled={syncStatus === 'syncing'}
                className="mt-1 flex-row items-center gap-1.5 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Jetzt synchronisieren"
              >
                {syncStatus === 'syncing' ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <RefreshCw color="#94a3b8" size={11} />
                )}
                <Text className="text-xs text-slate-400">
                  Zuletzt synchronisiert: {syncedAt ? formatSyncTime(syncedAt) : '–'}
                </Text>
              </Pressable>
            )}
            {lastUpdatedAt && (
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Zuletzt aktualisiert: {formatUpdatedAt(lastUpdatedAt)}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <GoldBarBadge />
            <HardRefreshButton />
            <ThemeToggle />
          </View>
        </View>

        <DateSelector onDaySelected={setDetailDate} />

        <View className="gap-6 lg:flex-row lg:items-start">
          <View className="gap-6 lg:w-[380px] lg:shrink-0">
            <View className="items-center gap-5 rounded-[28px] border border-slate-200/60 bg-white/70 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
              <View className="items-center gap-1">
                <ProgressRing size={RING_SIZE} strokeWidth={RING_STROKE} progress={caloriePct} color={ACCENT}>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">Verbleibend</Text>
                  <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{remainingCalories}</Text>
                  <Text className="text-xs text-slate-400">von {user.dailyCalorieGoal} kcal</Text>
                </ProgressRing>
                <Text className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round(totalCalories)} kcal gegessen
                </Text>
              </View>

              <View className="w-full flex-row gap-3 border-t border-slate-200/50 pt-5 dark:border-slate-800/60">
                {CORE_MACROS.map((key) => (
                  <MacroBadge key={key} nutrientKey={key} amount={nutrientAmounts[key]} goal={nutrientGoals[key]} />
                ))}
              </View>

              {secondaryNutrients.length > 0 && (
                <View className="w-full flex-row flex-wrap gap-x-4 gap-y-4 border-t border-slate-200/50 pt-4 dark:border-slate-800/60">
                  {secondaryNutrients.map((key) => (
                    <NutrientTile key={key} nutrientKey={key} amount={nutrientAmounts[key]} goal={nutrientGoals[key]} />
                  ))}
                </View>
              )}
            </View>

            <View className="gap-3 rounded-[28px]">
              <Text className="px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Für dich</Text>
              <AiRecommendationCard
                remainingCalories={remainingCalories}
                remainingMacros={remainingMacros}
                visibleNutrients={user.visibleNutrients}
              />
            </View>
          </View>

          <View className="flex-1 gap-3">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Mahlzeiten</Text>
            <View className="gap-4">
              {MEAL_TYPES.map((mealType) => (
                <MealCard key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
              ))}
            </View>
          </View>
        </View>

        <DeficitAnalyzerCard />

        <Text className="mb-6 self-start rounded-md bg-slate-50/90 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-background-dark/90">
          App-Build: {getLastUpdatedLabel()} Uhr
        </Text>
      </ScrollView>

      <DayDetailModal date={detailDate} onClose={() => setDetailDate(null)} />
    </SafeAreaView>
  );
}
