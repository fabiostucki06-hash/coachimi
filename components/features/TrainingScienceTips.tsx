import { BookOpen, ChevronDown, Dumbbell, Gauge, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';

interface ScienceTip {
  id: string;
  Icon: typeof Dumbbell;
  title: string;
  insight: string;
}

/**
 * Static, evidence-based training guidance - not personalized to logged sets/reps
 * (the app doesn't tag exercises by muscle group or track RIR/rest time yet), so
 * these are presented as general reference context rather than claims about the
 * user's own numbers.
 */
const TIPS: ScienceTip[] = [
  {
    id: 'volume',
    Icon: Dumbbell,
    title: 'Progressive Overload',
    insight:
      'Studieneinblick: 10-20 Sätze pro Muskelgruppe/Woche gelten laut Schoenfeld et al. (2021) als effektiver Bereich für Muskelaufbau.',
  },
  {
    id: 'rest',
    Icon: Timer,
    title: 'Satzpausen',
    insight:
      'Studieneinblick: 2-3 Min. Pause maximieren die mechanische Spannung für Kraftaufbau (Schoenfeld et al., 2016); 60-90s reichen für metabolischen Stress bei Hypertrophie-Fokus (Longo et al., 2022).',
  },
  {
    id: 'rir',
    Icon: Gauge,
    title: 'RIR statt starrer Vorgaben',
    insight:
      'Studieneinblick: 1-3 Wiederholungen im Tank (RIR) halten die Intensität nach Zourdos et al. (2016) automatisch nah am Trainingsmaximum, ohne jeden Satz bis zum Muskelversagen zu treiben.',
  },
];

/** Collapsed-by-default reference card citing the exercise-science literature behind this screen's progression logic (double progression, deload triggers) - kept out of the way so it doesn't compete with the actual workout log. */
export function TrainingScienceTips() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="gap-1">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center justify-between py-1"
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Studien-Insights einklappen' : 'Studien-Insights ausklappen'}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100/70 dark:bg-white/5">
            <BookOpen color="#64748b" size={18} />
          </View>
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Studien-Insights</Text>
        </View>
        <ChevronDown color="#64748b" size={18} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Pressable>

      {expanded && (
        <View className="gap-3 pt-3">
          {TIPS.map((tip) => (
            <View key={tip.id} className="flex-row items-start gap-2.5 rounded-xl bg-slate-100/70 p-2.5 dark:bg-white/5">
              <tip.Icon color="#64748b" size={14} />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tip.title}</Text>
                <Text className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{tip.insight}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
