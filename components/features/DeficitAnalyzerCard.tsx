import { FlaskConical } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { sumEntryNutrients } from '@/components/features/nutrientMeta';
import { useDiaryStore } from '@/store/diaryStore';
import { useUserStore } from '@/store/userStore';
import { getLocalDateKey } from '@/utils/calendarDates';
import { analyzeNutrientDeficits, MIN_DAYS_FOR_ANALYSIS, type DailyNutrientSnapshot, type DeficitNutrientKey } from '@/utils/coachTips';
import type { MealEntry } from '@/types';

/** Trailing window to scan for a multi-day average - matches the 3-7 day range D-A-CH/EFSA references are meant to be judged over, not a single day. */
const LOOKBACK_DAYS = 7;

const ALL_KEYS: DeficitNutrientKey[] = ['iron', 'protein', 'fiber', 'magnesium'];
/** Protein is a required macro (always a real number, never missing source data) - only these three are ever silently "untracked" because a food simply didn't report them. */
const MICRONUTRIENT_KEYS: DeficitNutrientKey[] = ['iron', 'fiber', 'magnesium'];

/** Whether any food logged that day actually reported this nutrient, vs it defaulting to 0 purely because no source had the data. */
function isTrackedForDay(entries: MealEntry[], key: DeficitNutrientKey): boolean {
  if (key === 'protein') return true;
  return entries.some((entry) => entry.foodItem.micronutrientsPerServing[key] !== undefined);
}

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

  const { deficits, showNeutralHint } = useMemo(() => {
    const loggedDays = getTrailingDateKeys(LOOKBACK_DAYS)
      .map((date) => ({ date, entries: entriesByDate[date] ?? [] }))
      .filter(({ entries }) => entries.length > 0);

    const snapshots: DailyNutrientSnapshot[] = loggedDays.map(({ date, entries }) => {
      const totals = sumEntryNutrients(entries);
      const trackedKeys = ALL_KEYS.filter((key) => isTrackedForDay(entries, key));
      return { date, iron: totals.iron, protein: totals.protein, fiber: totals.fiber, magnesium: totals.magnesium, trackedKeys };
    });

    const deficits = analyzeNutrientDeficits(snapshots, proteinGoal);

    // True "no data" state: none of the actual micronutrients (protein excluded - it's
    // a required macro, always present) ever had enough real tracked days to even be
    // judged. Only then is a neutral nudge shown instead of silently showing nothing -
    // showing nothing would be indistinguishable from "your diet looks fine".
    const hasEvaluableMicronutrientData = MICRONUTRIENT_KEYS.some(
      (key) => snapshots.filter((day) => day.trackedKeys?.includes(key)).length >= MIN_DAYS_FOR_ANALYSIS,
    );

    return {
      deficits,
      showNeutralHint: snapshots.length >= MIN_DAYS_FOR_ANALYSIS && deficits.length === 0 && !hasEvaluableMicronutrientData,
    };
  }, [entriesByDate, proteinGoal]);

  if (deficits.length === 0 && !showNeutralHint) return null;

  return (
    <View className="gap-3 rounded-[28px] border border-slate-200/60 bg-white/70 p-4 shadow-md shadow-slate-900/5 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
      <View className="flex-row items-center gap-3">
        <View className={`h-9 w-9 items-center justify-center rounded-full ${deficits.length > 0 ? 'bg-amber-500/10' : 'bg-slate-500/10'}`}>
          <FlaskConical color={deficits.length > 0 ? '#d97706' : '#64748b'} size={16} />
        </View>
        <Text className="flex-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {deficits.length > 0 ? `Nährstoff-Check (${deficits[0].daysAnalyzed} Tage)` : 'Nährstoff-Check'}
        </Text>
      </View>

      {deficits.length > 0 ? (
        deficits.slice(0, 2).map((deficit) => (
          <View key={deficit.key} className="gap-1">
            <Text className="text-xs leading-5 text-slate-600 dark:text-slate-300">{deficit.message}</Text>
            {deficit.citation && (
              <Text className="text-[11px] italic leading-4 text-slate-400 dark:text-slate-500">{deficit.citation}</Text>
            )}
          </View>
        ))
      ) : (
        <Text className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          Tracke vitaminreiche Lebensmittel für deinen Nährstoff-Check.
        </Text>
      )}
    </View>
  );
}
