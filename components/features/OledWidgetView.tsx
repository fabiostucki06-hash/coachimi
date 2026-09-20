import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NUTRIENT_META, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { notifyDataChanged } from '@/hooks/useServiceWorker';
import { getMicronutrientGoalsForDiet } from '@/services/dietEngine';
import { todayKey, useDiaryStore } from '@/store/diaryStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry } from '@/types';

const OVER_LIMIT_ACCENT = '#F59E0B';
const REMAINING_ACCENT = '#22c55e';
const EMPTY_ENTRIES: MealEntry[] = [];

function MetricBar({ label, value, unit, pct, color }: { label: string; value: number; unit: string; pct: number; color: string }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</Text>
        <Text className="text-sm font-semibold text-white">
          {Math.round(value)}
          <Text className="text-[11px] font-normal text-white/50">{unit}</Text>
        </Text>
      </View>
      <View className="h-1 w-full rounded-full bg-white/10">
        <View className="h-1 rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

/**
 * Ultra-compact "OLED snapshot" - the three numbers worth glancing at without
 * opening the full diary: calories left/over, Eisen (iron), Zucker (sugar).
 * True OS-level home-screen/lock-screen widgets (iOS WidgetKit, Android App
 * Widget, Windows Widgets Board) need native platform code a PWA manifest
 * can't provide - see WIDGET_ACTION_ROUTES in useWidgetDeepLinks.ts for the
 * same boundary. This screen plus the manifest.json `shortcuts` entry
 * pointing at it is the closest a PWA can get: an ultra-fast, single-purpose
 * view a shortcut/bookmark can land on directly.
 */
export function OledWidgetView() {
  const date = todayKey();
  const entries = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES);
  const dailyCalorieGoal = useUserStore((state) => state.user.dailyCalorieGoal);
  const dietType = useUserStore((state) => state.user.dietType) ?? 'balanced';
  const gender = useUserStore((state) => state.user.gender);
  const micronutrientGoalOverrides = useUserStore((state) => state.user.micronutrientGoalOverrides);

  // Cross-tab freshness: when the widget is opened as its own standalone PWA
  // window (the normal way a home-screen shortcut launches), it has no other
  // way to hear about an entry logged in an already-open main-app tab - the
  // two are separate top-level windows, not parent/child. The service worker
  // (public/sw.js) relays a "data changed" ping between every window it
  // controls; on that ping, re-pulling both persisted stores picks up
  // whatever the other tab just wrote to the same AsyncStorage/localStorage.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'coach-imi-data-changed') return;
      void useDiaryStore.persist.rehydrate();
      void useUserStore.persist.rehydrate();
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const { remainingCalories, isOverLimit, surplusCalories, iron, sugar, ironGoal, sugarGoal } = useMemo(() => {
    const totalCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
    const nutrients = sumEntryNutrients(entries);
    const goals = getMicronutrientGoalsForDiet(dietType, gender, micronutrientGoalOverrides);
    return {
      remainingCalories: Math.round(Math.max(dailyCalorieGoal - totalCalories, 0)),
      isOverLimit: dailyCalorieGoal > 0 && totalCalories > dailyCalorieGoal,
      surplusCalories: Math.round(Math.max(totalCalories - dailyCalorieGoal, 0)),
      iron: nutrients.iron,
      sugar: nutrients.sugar,
      ironGoal: goals.iron,
      sugarGoal: goals.sugar,
    };
  }, [entries, dailyCalorieGoal, dietType, gender, micronutrientGoalOverrides]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Pressable
        className="flex-1 justify-center gap-6 px-6 active:opacity-80"
        onPress={() => {
          notifyDataChanged();
          router.replace('/');
        }}
        accessibilityRole="button"
        accessibilityLabel="Coach imi öffnen"
      >
        <View className="items-center gap-1">
          <View className="flex-row items-center gap-1.5">
            <Flame color={isOverLimit ? OVER_LIMIT_ACCENT : REMAINING_ACCENT} size={14} />
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
              {isOverLimit ? 'Über Ziel' : 'Verbleibend'}
            </Text>
          </View>
          <Text className={`text-6xl font-bold tracking-tight ${isOverLimit ? 'text-amber-500' : 'text-white'}`}>
            {isOverLimit ? `+${surplusCalories}` : remainingCalories}
          </Text>
          <Text className="text-xs text-white/40">kcal · von {Math.round(dailyCalorieGoal)}</Text>
        </View>

        <View className="gap-3 rounded-3xl bg-[#121212] p-4">
          <MetricBar
            label={NUTRIENT_META.iron.label}
            value={iron}
            unit={NUTRIENT_META.iron.unit}
            pct={(iron / ironGoal) * 100}
            color={NUTRIENT_META.iron.color}
          />
          <MetricBar
            label={NUTRIENT_META.sugar.label}
            value={sugar}
            unit={NUTRIENT_META.sugar.unit}
            pct={(sugar / sugarGoal) * 100}
            color={NUTRIENT_META.sugar.color}
          />
        </View>

        <Text className="text-center text-[10px] uppercase tracking-widest text-white/25">Antippen zum Öffnen</Text>
      </Pressable>
    </SafeAreaView>
  );
}
