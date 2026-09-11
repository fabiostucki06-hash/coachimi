import { FlaskConical } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { sumEntryNutrients } from '@/components/features/nutrientMeta';
import { useDiaryStore } from '@/store/diaryStore';
import { useUserStore } from '@/store/userStore';
import { getLocalDateKey } from '@/utils/calendarDates';
import { analyzeNutrientDeficits, type DailyNutrientSnapshot } from '@/utils/coachTips';

/** Trailing window to scan for a multi-day average - matches the 3-7 day range D-A-CH/EFSA references are meant to be judged over, not a single day. */
const LOOKBACK_DAYS = 7;

function getTrailingDateKeys(days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    keys.push(getLocalDateKey(date));
  }
  return keys;
}

export function DeficitAnalyzerCard() {
  const entriesByDate = useDiaryStore((state) => state.entriesByDate);
  const proteinGoal = useUserStore((state) => state.user.dailyMacroGoal.protein);

  const deficits = useMemo(() => {
    const snapshots: DailyNutrientSnapshot[] = getTrailingDateKeys(LOOKBACK_DAYS)
      .map((date) => ({ date, entries: entriesByDate[date] ?? [] }))
      .filter(({ entries }) => entries.length > 0)
      .map(({ date, entries }) => {
        const totals = sumEntryNutrients(entries);
        return { date, iron: totals.iron, protein: totals.protein, fiber: totals.fiber, magnesium: totals.magnesium };
      });

    return analyzeNutrientDeficits(snapshots, proteinGoal);
  }, [entriesByDate, proteinGoal]);

  if (deficits.length === 0) return null;

  return (
    <View className="gap-3 rounded-[28px] border border-slate-200/60 bg-white/70 p-4 shadow-md shadow-slate-900/5 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
          <FlaskConical color="#d97706" size={16} />
        </View>
        <Text className="flex-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Nährstoff-Check ({deficits[0].daysAnalyzed} Tage)
        </Text>
      </View>

      {deficits.slice(0, 2).map((deficit) => (
        <Text key={deficit.key} className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          {deficit.message}
        </Text>
      ))}
    </View>
  );
}
