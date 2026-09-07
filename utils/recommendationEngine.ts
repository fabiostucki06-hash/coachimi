import type { Macros } from '@/types';

export type TimeOfDay = 'morning' | 'midday' | 'evening';

export interface Recommendation {
  timeLabel: string;
  headline: string;
  suggestion: string;
  /** Size of the tip pool this recommendation was drawn from - lets the UI cycle through every matching tip without repeats. */
  variantCount: number;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morgens',
  midday: 'Mittags',
  evening: 'Abends',
};

/** Tip pool grouped by which macro (or balanced calorie refill) it best fits. First entry per group stays stable so callers without a variantIndex get a deterministic pick. */
const TIPS_BY_MACRO: Record<'protein' | 'carbs' | 'fat' | 'balanced', string[]> = {
  carbs: [
    'Vollkornpasta mit Gemüsesoße',
    'Haferflocken mit Banane & Beeren',
    'Kartoffelecken aus dem Ofen',
    'Reiswaffeln mit Honig',
    'Couscous-Salat',
    'Quinoa-Bowl',
  ],
  protein: [
    'Magerquark mit Beeren',
    'Hähnchenbrustfilet',
    'Thunfisch im eigenen Saft',
    'Proteinpulver-Shake',
    'Hüttenkäse',
    'Griechischer Joghurt 0%',
    'Eiklar-Omelett',
  ],
  fat: [
    'Handvoll Mandeln/Walnüsse',
    'Avocado auf Vollkornbrot',
    'Erdnussmus auf Apfelscheiben',
    'Dunkle Schokolade (85%+)',
    'Olivenöl-Dressing',
  ],
  balanced: [
    'Lachsfilet mit Brokkoli und Süßkartoffel',
    'Vollkorn-Wrap mit Pute & Avocado',
    'Gemischter Salat mit Feta und Hähnchen',
  ],
};

const MACRO_LABELS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'Protein',
  carbs: 'Kohlenhydrate',
  fat: 'Fett',
};

/** If the two largest macro gaps sit within this many grams of each other, no single macro dominates - suggest a balanced meal instead. */
const BALANCE_THRESHOLD_G = 15;

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

function pickVariant(pool: string[], variantIndex: number): string {
  return pool[((variantIndex % pool.length) + pool.length) % pool.length];
}

export function generateRecommendation(
  timeOfDay: TimeOfDay,
  remainingCalories: number,
  remainingMacros: Macros,
  visibleMacros: Record<'protein' | 'carbs' | 'fat', boolean> = DEFAULT_VISIBLE_MACROS,
  variantIndex = 0,
): Recommendation {
  const timeLabel = TIME_LABELS[timeOfDay];
  const calories = Math.round(remainingCalories);

  if (remainingCalories <= 0) {
    return {
      timeLabel,
      headline: 'Tagesziel erreicht',
      suggestion: 'Du hast dein Kalorienziel bereits erreicht. Gönn deinem Körper jetzt lieber Ruhe statt Essen.',
      variantCount: 1,
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
      headline: `Noch ${calories} kcal übrig`,
      suggestion: `Eine ausgewogene, proteinreiche Mahlzeit passt gut zu deinen verbleibenden ${calories} kcal.`,
      variantCount: 1,
    };
  }

  const sortedGaps = [...gaps].sort((a, b) => b.remaining - a.remaining);
  const topGap = sortedGaps[0];
  const runnerUp = sortedGaps[1];
  const isBalanced = runnerUp !== undefined && topGap.remaining - runnerUp.remaining <= BALANCE_THRESHOLD_G;

  if (isBalanced) {
    const pool = TIPS_BY_MACRO.balanced;
    const suggestion = pickVariant(pool, variantIndex);
    return {
      timeLabel,
      headline: `Noch ${calories} kcal übrig`,
      suggestion: `${suggestion} passt gut in dein verbleibendes Budget von ${calories} kcal.`,
      variantCount: pool.length,
    };
  }

  const macroLabel = MACRO_LABELS[topGap.key];
  const pool = TIPS_BY_MACRO[topGap.key];
  const suggestion = pickVariant(pool, variantIndex);

  return {
    timeLabel,
    headline: `Noch ${Math.round(topGap.remaining)}g ${macroLabel} übrig`,
    suggestion: `${suggestion} passt perfekt zu deinen verbleibenden ${calories} kcal.`,
    variantCount: pool.length,
  };
}
