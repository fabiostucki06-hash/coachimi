import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MEAL_TYPES, MEAL_TYPE_META } from '@/components/features/mealMeta';
import { NUTRIENT_META } from '@/components/features/nutrientMeta';
import { useDiaryStore } from '@/store/diaryStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry, MealType, NutrientKey } from '@/types';

const ACCENT = '#10b981';
const EMPTY_ENTRIES: MealEntry[] = [];
const CORE_MACROS: NutrientKey[] = ['protein', 'carbs', 'fat'];

interface MealTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function sumMeal(entries: MealEntry[]): MealTotals {
  return entries.reduce(
    (totals, entry) => {
      const { foodItem, servings } = entry;
      return {
        kcal: totals.kcal + foodItem.caloriesPerServing * servings,
        protein: totals.protein + foodItem.macrosPerServing.protein * servings,
        carbs: totals.carbs + foodItem.macrosPerServing.carbs * servings,
        fat: totals.fat + foodItem.macrosPerServing.fat * servings,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function MacroGoalRow({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="flex-1 gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={13} />
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

function MealSection({ mealType, entries }: { mealType: MealType; entries: MealEntry[] }) {
  const { label, Icon } = MEAL_TYPE_META[mealType];
  const totals = useMemo(() => sumMeal(entries), [entries]);

  return (
    <View className="gap-3 rounded-[24px] border border-slate-200/60 bg-white/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
            <Icon color={ACCENT} size={16} />
          </View>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white">{label}</Text>
        </View>
        {entries.length > 0 && (
          <Text className="text-xs text-slate-400">
            {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g P · {Math.round(totals.carbs)}g C · {Math.round(totals.fat)}g F
          </Text>
        )}
      </View>

      {entries.length === 0 ? (
        <Text className="text-xs text-slate-400">Keine Einträge</Text>
      ) : (
        <View className="gap-2 border-t border-slate-200/50 pt-3 dark:border-slate-800/60">
          {entries.map((entry) => (
            <View key={entry.id} className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm text-slate-700 dark:text-slate-200" numberOfLines={1}>
                  {entry.foodItem.name}
                </Text>
                <Text className="text-xs text-slate-400">
                  {entry.servings}× {entry.foodItem.servingSize}{entry.foodItem.servingUnit}
                </Text>
              </View>
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                {Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface DayDetailModalProps {
  /** Date key (YYYY-MM-DD) to show details for, or null to keep the modal closed. */
  date: string | null;
  onClose: () => void;
}

export function DayDetailModal({ date, onClose }: DayDetailModalProps) {
  const entries = useDiaryStore((state) => (date ? state.entriesByDate[date] ?? EMPTY_ENTRIES : EMPTY_ENTRIES));
  const user = useUserStore((state) => state.user);

  const { entriesByMealType, totalCalories, totalMacros } = useMemo(() => {
    const grouped: Record<MealType, MealEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
    for (const entry of entries) {
      grouped[entry.mealType].push(entry);
    }
    const totals = sumMeal(entries);
    return {
      entriesByMealType: grouped,
      totalCalories: totals.kcal,
      totalMacros: { protein: totals.protein, carbs: totals.carbs, fat: totals.fat },
    };
  }, [entries]);

  const dateLabel = date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Modal visible={date !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-slate-900/50" onPress={onClose}>
        <Pressable
          className="max-h-[88%] gap-5 rounded-t-[32px] bg-slate-50 px-6 pb-8 pt-5 dark:bg-background-dark"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center">
            <View className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          </View>

          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {dateLabel}
            </Text>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-200/70 active:opacity-80 dark:bg-slate-800/70"
              onPress={onClose}
              accessibilityLabel="Schliessen"
            >
              <X color="#64748b" size={18} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 pb-4">
            <View className="gap-4 rounded-[24px] border border-slate-200/60 bg-white/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Kalorien</Text>
                <Text className="text-base font-bold text-slate-900 dark:text-white">
                  {Math.round(totalCalories)} <Text className="text-xs font-normal text-slate-400">/ {user.dailyCalorieGoal} kcal</Text>
                </Text>
              </View>
              <View className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                <View
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${user.dailyCalorieGoal > 0 ? Math.min(Math.round((totalCalories / user.dailyCalorieGoal) * 100), 100) : 0}%` }}
                />
              </View>

              <View className="flex-row gap-3 border-t border-slate-200/50 pt-4 dark:border-slate-800/60">
                {CORE_MACROS.map((key) => (
                  <MacroGoalRow key={key} nutrientKey={key} amount={totalMacros[key as keyof typeof totalMacros]} goal={user.dailyMacroGoal[key as keyof typeof user.dailyMacroGoal]} />
                ))}
              </View>
            </View>

            <View className="gap-3">
              {MEAL_TYPES.map((mealType) => (
                <MealSection key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
