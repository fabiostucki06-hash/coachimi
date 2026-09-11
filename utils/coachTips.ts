import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

export type DeficitNutrientKey = 'iron' | 'protein' | 'fiber' | 'magnesium';

export interface DailyNutrientSnapshot {
  date: string;
  iron: number;
  protein: number;
  fiber: number;
  magnesium: number;
}

export interface NutrientDeficit {
  key: DeficitNutrientKey;
  label: string;
  unit: string;
  daysAnalyzed: number;
  averagePerDay: number;
  rda: number;
  /** How far below the RDA the average sits, 0-1 (0 = at/above RDA). */
  deficitRatio: number;
  message: string;
}

const LABELS: Record<DeficitNutrientKey, string> = {
  iron: 'Eisen',
  protein: 'Protein',
  fiber: 'Ballaststoffe',
  magnesium: 'Magnesium',
};

const UNITS: Record<DeficitNutrientKey, string> = {
  iron: 'mg',
  protein: 'g',
  fiber: 'g',
  magnesium: 'mg',
};

/** Concrete, evidence-based food sources per nutrient - referenced against EFSA/D-A-CH daily reference intakes, same standard `MICRONUTRIENT_GOALS` already uses for progress bars. */
const FOOD_SUGGESTIONS: Record<DeficitNutrientKey, string> = {
  iron: '100g Linsen oder Kürbiskerne decken deinen Tagesbedarf nach D-A-CH/EFSA-Referenzwert.',
  protein: 'Ein zusätzlicher Proteinshake oder 150g Hähnchenbrust schließen die Lücke effektiv.',
  fiber: 'Eine Portion Haferflocken oder ein Vollkornbrot erhöhen deine Ballaststoffzufuhr spürbar.',
  magnesium: 'Eine Handvoll Kürbiskerne oder Mandeln liefert einen Großteil deines Tagesbedarfs an Magnesium.',
};

/** Only flag a nutrient once the multi-day average sits meaningfully below the RDA - avoids noisy tips from single-day rounding. */
const DEFICIT_THRESHOLD_RATIO = 0.85;

/** Need at least this many logged days in the window before an average is trustworthy enough to show. */
export const MIN_DAYS_FOR_ANALYSIS = 3;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Analyzes the last 3-7 logged days for nutrient deficits against scientific reference
 * intakes (D-A-CH/EFSA), returning the worst deficits first. `snapshots` should already be
 * filtered to only the days the user actually logged something - averaging over unlogged
 * (all-zero) days would understate intake rather than reflect an actual deficit.
 */
export function analyzeNutrientDeficits(
  snapshots: DailyNutrientSnapshot[],
  proteinRdaOverride?: number,
): NutrientDeficit[] {
  if (snapshots.length < MIN_DAYS_FOR_ANALYSIS) return [];

  const rdaByKey: Record<DeficitNutrientKey, number> = {
    iron: MICRONUTRIENT_GOALS.iron,
    protein: proteinRdaOverride && proteinRdaOverride > 0 ? proteinRdaOverride : 0.8 * 70, // D-A-CH baseline 0.8g/kg for a 70kg reference adult when no personal goal is known
    fiber: MICRONUTRIENT_GOALS.fiber,
    magnesium: MICRONUTRIENT_GOALS.magnesium,
  };

  const keys: DeficitNutrientKey[] = ['iron', 'protein', 'fiber', 'magnesium'];
  const deficits: NutrientDeficit[] = [];

  for (const key of keys) {
    const rda = rdaByKey[key];
    if (rda <= 0) continue;

    const average = snapshots.reduce((sum, day) => sum + day[key], 0) / snapshots.length;
    const deficitRatio = Math.max(0, 1 - average / rda);
    if (average / rda >= DEFICIT_THRESHOLD_RATIO) continue;

    const averagePerDay = round1(average);
    deficits.push({
      key,
      label: LABELS[key],
      unit: UNITS[key],
      daysAnalyzed: snapshots.length,
      averagePerDay,
      rda,
      deficitRatio,
      message: `Du hattest in den letzten ${snapshots.length} Tagen im Schnitt nur ${averagePerDay}${UNITS[key]} ${LABELS[key]}/Tag. ${FOOD_SUGGESTIONS[key]}`,
    });
  }

  return deficits.sort((a, b) => b.deficitRatio - a.deficitRatio);
}
