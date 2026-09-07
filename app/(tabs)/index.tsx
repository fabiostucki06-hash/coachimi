import { router } from 'expo-router';
import { Camera, Coffee, Cookie, GlassWater, Moon, Plus, RefreshCw, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiRecommendationCard } from '@/components/features/AiRecommendationCard';
import { DateSelector } from '@/components/features/DateSelector';
import { NUTRIENT_META, NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { HardRefreshButton } from '@/components/ui/HardRefreshButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useDiaryStore } from '@/store/diaryStore';
import { useSyncStore } from '@/store/syncStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { Macros, MealEntry, MealType, NutrientKey } from '@/types';
import { getLastUpdatedLabel } from '@/utils/lastUpdated';
import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

interface IconProps {
  color?: string;
  size?: number;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

const MEAL_TYPE_META: Record<MealType, { label: string; Icon: ComponentType<IconProps> }> = {
  breakfast: { label: 'Frühstück', Icon: Coffee },
  lunch: { label: 'Mittagessen', Icon: UtensilsCrossed },
  dinner: { label: 'Abendessen', Icon: Moon },
  snack: { label: 'Snacks', Icon: Cookie },
  drinks: { label: 'Getränke', Icon: GlassWater },
};

const ACCENT = '#10b981';
const RING_SIZE = 176;
const RING_STROKE = 16;
const EMPTY_ENTRIES: MealEntry[] = [];

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  return (
    <Pressable
      className="gap-3 rounded-[28px] border border-slate-200/60 bg-white/70 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl active:opacity-90 dark:border-slate-800/60 dark:bg-slate-900/60 dark:shadow-black/20"
      onPress={() => router.push({ pathname: '/meal-detail', params: { mealType } })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Icon color={ACCENT} size={18} />
          </View>
          <View>
            <Text className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{label}</Text>
            <Text className="text-xs text-slate-400">
              {entries.length > 0 ? `${Math.round(kcal)} kcal` : 'Noch keine Einträge'}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 active:opacity-80 active:bg-emerald-500/20"
            onPress={() => router.push({ pathname: '/meal-parser', params: { mealType } })}
          >
            <Sparkles color={ACCENT} size={16} />
          </Pressable>
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 active:opacity-80 active:bg-emerald-500/20"
            onPress={() => router.push({ pathname: '/analyze-food', params: { mealType } })}
          >
            <Camera color={ACCENT} size={16} />
          </Pressable>
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30 active:opacity-90 active:bg-emerald-600"
            onPress={() => router.push({ pathname: '/add-food', params: { mealType } })}
          >
            <Plus color="#ffffff" size={16} />
          </Pressable>
        </View>
      </View>

      {entries.length > 0 && (
        <View className="gap-2 border-t border-slate-200/50 pt-3 dark:border-slate-800/60">
          {entries.map((entry) => (
            <View key={entry.id} className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-slate-600 dark:text-slate-300" numberOfLines={1}>
                {entry.foodItem.name}
              </Text>
              <Text className="text-sm text-slate-400">
                {Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function DiaryScreen() {
  const date = useUiStore((state) => state.selectedDate);
  const entries = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES);
  const user = useUserStore((state) => state.user);
  const session = useSyncStore((state) => state.session);
  const syncStatus = useSyncStore((state) => state.status);
  const remoteUpdatedAt = useSyncStore((state) => state.remoteUpdatedAt);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const syncNow = useSyncStore((state) => state.syncNow);
  const syncedAt = remoteUpdatedAt ?? lastSyncedAt;

  const selectedDateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const entriesByMealType: Record<MealType, MealEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    drinks: [],
  };
  for (const entry of entries) {
    entriesByMealType[entry.mealType].push(entry);
  }

  const totalCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const nutrientAmounts = sumEntryNutrients(entries);
  const totalMacros: Macros = { carbs: nutrientAmounts.carbs, protein: nutrientAmounts.protein, fat: nutrientAmounts.fat };
  const nutrientGoals: Record<NutrientKey, number> = { ...user.dailyMacroGoal, ...MICRONUTRIENT_GOALS };
  const visibleNutrients = NUTRIENT_ORDER.filter((key) => user.visibleNutrients[key]);

  const remainingCalories = Math.round(Math.max(user.dailyCalorieGoal - totalCalories, 0));
  const caloriePct = user.dailyCalorieGoal > 0 ? totalCalories / user.dailyCalorieGoal : 0;
  const remainingMacros: Macros = {
    carbs: Math.max(user.dailyMacroGoal.carbs - totalMacros.carbs, 0),
    protein: Math.max(user.dailyMacroGoal.protein - totalMacros.protein, 0),
    fat: Math.max(user.dailyMacroGoal.fat - totalMacros.fat, 0),
  };

  return (
    <SafeAreaView className="relative flex-1 bg-slate-50 dark:bg-background-dark">
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
          </View>
          <View className="flex-row items-center gap-2">
            <HardRefreshButton />
            <ThemeToggle />
          </View>
        </View>

        <DateSelector />

        <View className="gap-6 lg:flex-row lg:items-start">
          <View className="gap-6 lg:w-[380px] lg:shrink-0">
            <View className="items-center gap-4 rounded-[32px] border border-slate-200/60 bg-white/70 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
              <ProgressRing size={RING_SIZE} strokeWidth={RING_STROKE} progress={caloriePct} color={ACCENT}>
                <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{Math.round(totalCalories)}</Text>
                <Text className="text-xs text-slate-400">von {user.dailyCalorieGoal} kcal</Text>
              </ProgressRing>

              <Text className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {remainingCalories} kcal übrig
              </Text>

              {visibleNutrients.length > 0 && (
                <View className="w-full flex-row flex-wrap gap-x-4 gap-y-4 border-t border-slate-200/50 pt-4 dark:border-slate-800/60">
                  {visibleNutrients.map((key) => (
                    <NutrientTile key={key} nutrientKey={key} amount={nutrientAmounts[key]} goal={nutrientGoals[key]} />
                  ))}
                </View>
              )}
            </View>

            <AiRecommendationCard
              remainingCalories={remainingCalories}
              remainingMacros={remainingMacros}
              visibleNutrients={user.visibleNutrients}
            />
          </View>

          <View className="flex-1 gap-3">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Mahlzeiten</Text>
            {MEAL_TYPES.map((mealType) => (
              <MealCard key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
            ))}
          </View>
        </View>
      </ScrollView>

      <Text className="absolute bottom-24 left-4 rounded-md bg-slate-50/90 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-background-dark/90 lg:bottom-6">
        App-Build: {getLastUpdatedLabel()} Uhr
      </Text>
    </SafeAreaView>
  );
}
