import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDiaryStore } from '@/store/diaryStore';
import { useUserStore } from '@/store/userStore';
import { getLocalDateKey } from '@/utils/calendarDates';

const IN_GOAL_COLOR = '#10b981';
const OVER_GOAL_COLOR = '#f59e0b';
const EMPTY_COLOR = '#e2e8f0';
const CHART_HEIGHT = 120;
const DAYS_IN_WEEK = 7;

interface DayStat {
  key: string;
  label: string;
  calories: number;
}

function getLastNDays(days: number): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      key: getLocalDateKey(date),
      label: date.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2),
    });
  }
  return result;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-md shadow-slate-900/5 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
      <Text className="text-xs text-slate-500 dark:text-slate-400">{label}</Text>
      <Text className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</Text>
    </View>
  );
}

export default function StatistikScreen() {
  const entriesByDate = useDiaryStore((state) => state.entriesByDate);
  const user = useUserStore((state) => state.user);
  const weightHistory = useUserStore((state) => state.weightHistory);

  const dailyCalorieGoal = user.dailyCalorieGoal;

  const { weekStats, loggedDays, averageCalories, daysInGoal, maxCalories } = useMemo(() => {
    const weekStats: DayStat[] = getLastNDays(DAYS_IN_WEEK).map(({ key, label }) => {
      const entries = entriesByDate[key] ?? [];
      const calories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
      return { key, label, calories: Math.round(calories) };
    });

    const loggedDays = weekStats.filter((day) => day.calories > 0);
    const averageCalories = loggedDays.length > 0
      ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length)
      : 0;
    const daysInGoal = loggedDays.filter((day) => day.calories <= dailyCalorieGoal).length;

    const maxCalories = Math.max(...weekStats.map((day) => day.calories), dailyCalorieGoal);

    return { weekStats, loggedDays, averageCalories, daysInGoal, maxCalories };
  }, [entriesByDate, dailyCalorieGoal]);

  const weightChange =
    weightHistory.length >= 2
      ? weightHistory[weightHistory.length - 1].weightKg - weightHistory[0].weightKg
      : 0;
  const weightChangeLabel = weightHistory.length >= 2 ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '—';

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="flex-1 gap-6 px-6 pt-4 pb-32 lg:px-10 lg:pb-12">
        <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Statistik</Text>

        <View className="gap-6 lg:flex-row lg:items-start">
          <View className="gap-4 lg:w-72 lg:shrink-0">
            <View className="flex-row gap-4 lg:flex-col">
              <StatTile label="Ø Kalorien / Tag" value={loggedDays.length > 0 ? `${averageCalories} kcal` : '—'} />
              <StatTile label="Tage im Ziel" value={`${daysInGoal} von ${loggedDays.length}`} />
            </View>

            <View className="flex-row gap-4 lg:flex-col">
              <StatTile label="Gewichtsänderung" value={weightChangeLabel} />
              <StatTile label="Aktuelles Gewicht" value={user.weightKg ? `${user.weightKg} kg` : '—'} />
            </View>
          </View>

          <View className="flex-1 gap-4 rounded-[28px] border border-slate-200/60 bg-white/70 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Kalorien letzte 7 Tage</Text>

            <View style={{ height: CHART_HEIGHT }} className="flex-row items-end justify-between">
              {weekStats.map((day) => {
                const hasEntries = day.calories > 0;
                const barHeight = hasEntries ? Math.max((day.calories / maxCalories) * CHART_HEIGHT, 4) : 4;
                const isOverGoal = day.calories > dailyCalorieGoal;

                return (
                  <View key={day.key} className="items-center gap-2">
                    <View
                      className="w-4 rounded-t"
                      style={{
                        height: barHeight,
                        backgroundColor: !hasEntries ? EMPTY_COLOR : isOverGoal ? OVER_GOAL_COLOR : IN_GOAL_COLOR,
                      }}
                    />
                    <Text className="text-xs text-slate-400">{day.label}</Text>
                  </View>
                );
              })}
            </View>

            <View className="flex-row items-center gap-4 pt-1">
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: IN_GOAL_COLOR }} />
                <Text className="text-xs text-slate-500 dark:text-slate-400">Im Ziel</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: OVER_GOAL_COLOR }} />
                <Text className="text-xs text-slate-500 dark:text-slate-400">Über Ziel</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: EMPTY_COLOR }} />
                <Text className="text-xs text-slate-500 dark:text-slate-400">Keine Daten</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
