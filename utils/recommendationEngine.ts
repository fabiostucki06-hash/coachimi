import type { Macros } from '@/types';

export type TimeOfDay = 'morning' | 'midday' | 'evening';

export interface Recommendation {
  timeLabel: string;
  headline: string;
  suggestion: string;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morgens',
  midday: 'Mittags',
  evening: 'Abends',
};

const SUGGESTIONS_BY_MACRO: Record<'protein' | 'carbs' | 'fat', Record<TimeOfDay, string[]>> = {
  protein: {
    morning: ['Rührei mit Hüttenkäse', 'Griechischer Joghurt mit Nüssen', 'Proteinshake mit Haferflocken'],
    midday: ['Hähnchenbrust mit Quinoa', 'Linsensalat mit Feta', 'Thunfisch-Wrap mit Vollkorn'],
    evening: ['Magerquark mit Beeren', 'Gebackener Lachs mit Brokkoli', 'Hüttenkäse mit Paprika'],
  },
  carbs: {
    morning: ['Haferflocken mit Banane', 'Vollkorntoast mit Marmelade', 'Müsli mit Milch'],
    midday: ['Vollkornreis mit Gemüse', 'Kartoffeln mit Quark', 'Vollkornnudeln mit Tomatensauce'],
    evening: ['Vollkornbrot mit Honig', 'Süßkartoffel-Pommes', 'Reiswaffeln mit Banane'],
  },
  fat: {
    morning: ['Avocado-Toast', 'Nussmus auf Vollkornbrot', 'Chiapudding mit Kokosmilch'],
    midday: ['Nüsse & Olivenöl-Dressing', 'Avocado-Salat', 'Hummus mit Gemüsesticks'],
    evening: ['Ein Stück Käse mit Nüssen', 'Oliven & Feta', 'Dunkle Schokolade (85%)'],
  },
};

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'midday';
  return 'evening';
}

const DEFAULT_VISIBLE_MACROS: Record<'protein' | 'carbs' | 'fat', boolean> = {
  protein: true,
  carbs: true,
  fat: true,
};

export function generateRecommendation(
  timeOfDay: TimeOfDay,
  remainingCalories: number,
  remainingMacros: Macros,
  visibleMacros: Record<'protein' | 'carbs' | 'fat', boolean> = DEFAULT_VISIBLE_MACROS,
  variantIndex = 0,
): Recommendation {
  const timeLabel = TIME_LABELS[timeOfDay];

  if (remainingCalories <= 0) {
    return {
      timeLabel,
      headline: 'Tagesziel erreicht',
      suggestion: 'Du hast dein Kalorienziel bereits erreicht. Gönn deinem Körper jetzt lieber Ruhe statt Essen.',
    };
  }

  const allGaps: { key: 'protein' | 'carbs' | 'fat'; remaining: number }[] = [
    { key: 'protein', remaining: Math.max(remainingMacros.protein, 0) },
    { key: 'carbs', remaining: Math.max(remainingMacros.carbs, 0) },
    { key: 'fat', remaining: Math.max(remainingMacros.fat, 0) },
  ];
  const gaps = allGaps.filter((gap) => visibleMacros[gap.key]);

  // Every macro is hidden — fall back to a calorie-only tip that doesn't
  // name any macro, rather than picking one to reference anyway.
  if (gaps.length === 0) {
    return {
      timeLabel,
      headline: `Noch ${Math.round(remainingCalories)} kcal übrig`,
      suggestion: 'Eine ausgewogene, proteinreiche Mahlzeit passt gut in dein restliches Tagesbudget.',
    };
  }

  const topGap = gaps.reduce((max, gap) => (gap.remaining > max.remaining ? gap : max), gaps[0]);
  const macroLabel = topGap.key === 'protein' ? 'Protein' : topGap.key === 'carbs' ? 'Kohlenhydrate' : 'Fett';
  const options = SUGGESTIONS_BY_MACRO[topGap.key][timeOfDay];
  const suggestion = options[variantIndex % options.length];

  return {
    timeLabel,
    headline: `Noch ${Math.round(topGap.remaining)}g ${macroLabel} übrig`,
    suggestion: `${suggestion} passt gut zu den verbleibenden ${Math.round(remainingCalories)} kcal.`,
  };
}
