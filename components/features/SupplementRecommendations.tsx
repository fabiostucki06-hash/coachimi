import { Pill } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { sumEntryNutrients } from '@/components/features/nutrientMeta';
import { useDiaryStore } from '@/store/diaryStore';
import { countRecentTrainingDays } from '@/store/trainingStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry } from '@/types';
import { generateSupplementRecommendations } from '@/utils/supplementEngine';

const EMPTY_ENTRIES: MealEntry[] = [];

export function SupplementRecommendations() {
  const date = useUiStore((state) => state.selectedDate);
  const entries = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES);
  const proteinGoal = useUserStore((state) => state.user.dailyMacroGoal.protein);
  const trainingDaysLast7 = countRecentTrainingDays(7);

  const totals = sumEntryNutrients(entries);
  const proteinIntakeRatio = proteinGoal > 0 ? totals.protein / proteinGoal : null;

  const recommendations = generateSupplementRecommendations({ proteinIntakeRatio, trainingDaysLast7 });

  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100/70 dark:bg-white/5">
          <Pill color="#64748b" size={18} />
        </View>
        <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Supplement-Empfehlungen</Text>
      </View>

      {recommendations.map((recommendation) => (
        <View key={recommendation.id} className="gap-1 rounded-2xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-800/60 dark:bg-slate-900/60">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-900 dark:text-white">{recommendation.title}</Text>
            <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{recommendation.dose}</Text>
          </View>
          <Text className="text-xs text-slate-500 dark:text-slate-400">{recommendation.reason}</Text>
        </View>
      ))}

      <Text className="text-[11px] text-slate-400">
        Keine medizinische Beratung - bei Vorerkrankungen oder Medikamenteneinnahme ärztlich abklären.
      </Text>
    </Card>
  );
}
