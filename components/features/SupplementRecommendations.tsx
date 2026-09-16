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
        <View className="h-10 w-10 items-center justify-center rounded-full bg-overlay/5 ">
          <Pill color="#A1A1AA" size={18} />
        </View>
        <Text className="text-sm font-semibold text-text-secondary">Supplement-Empfehlungen</Text>
      </View>

      {recommendations.map((recommendation) => (
        <View key={recommendation.id} className="gap-1 rounded-2xl border border-surface-border bg-surface p-3  ">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">{recommendation.title}</Text>
            <Text className="text-xs font-medium text-primary">{recommendation.dose}</Text>
          </View>
          <Text className="text-xs text-text-secondary">{recommendation.reason}</Text>
        </View>
      ))}

      <Text className="text-[11px] text-text-secondary">
        Keine medizinische Beratung - bei Vorerkrankungen oder Medikamenteneinnahme ärztlich abklären.
      </Text>
    </Card>
  );
}
