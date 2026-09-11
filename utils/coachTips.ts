import { MICRONUTRIENT_GOALS } from '@/utils/nutritionCalculator';

export type DeficitNutrientKey = 'iron' | 'protein' | 'fiber' | 'magnesium';

export interface DailyNutrientSnapshot {
  date: string;
  iron: number;
  protein: number;
  fiber: number;
  magnesium: number;
  /**
   * Which of the four values above were actually reported by at least one food logged
   * that day, as opposed to silently defaulting to 0 because no source (Open Food
   * Facts, the community cache, ...) had the data for that specific product. Omit to
   * treat all four as tracked - e.g. for callers/tests that already know every value
   * is real. Without this, a day where every logged food simply lacks iron data reads
   * identically to a day where the user genuinely ate zero iron, understating the
   * average and reporting a "deficit" that's really just missing source data.
   */
  trackedKeys?: DeficitNutrientKey[];
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
  /** Short scientific-literature reference backing the RDA/food suggestion above, shown as supplementary context - undefined where no specific citation is attached (e.g. fiber). */
  citation?: string;
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

/**
 * Peer-reviewed context for each RDA/suggestion above, kept separate from the main
 * message so the UI can render it as a smaller, clearly-secondary line. Fiber has no
 * entry - EFSA's 25g reference is already implicit in `FOOD_SUGGESTIONS` and doesn't
 * carry a single well-known named study the way the other three do.
 */
const CITATIONS: Partial<Record<DeficitNutrientKey, string>> = {
  iron: 'Studieneinblick: EFSA/D-A-CH setzen die Referenzmenge auf 10-15mg Eisen/Tag - Vitamin C erhöht die Aufnahme von pflanzlichem (non-häm) Eisen deutlich (Hallberg et al.).',
  magnesium: 'Studieneinblick: EFSA empfiehlt 300-350mg Magnesium/Tag für Muskelregeneration und ATP-Synthese.',
  protein: 'Studieneinblick: Für Muskelaufbau optimiert laut Morton et al. (2018) eine Zufuhr von 1.6-2.2g Protein/kg Körpergewicht das Ergebnis.',
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

    // Average only over days that actually had real data for THIS nutrient - a day
    // where nothing logged reported iron shouldn't count as a zero-iron day and drag
    // the average down artificially. Fewer than MIN_DAYS_FOR_ANALYSIS real data points
    // isn't enough to trust either, same bar as the overall window below.
    const trackedDays = snapshots.filter((day) => !day.trackedKeys || day.trackedKeys.includes(key));
    if (trackedDays.length < MIN_DAYS_FOR_ANALYSIS) continue;

    const average = trackedDays.reduce((sum, day) => sum + day[key], 0) / trackedDays.length;
    const deficitRatio = Math.max(0, 1 - average / rda);
    if (average / rda >= DEFICIT_THRESHOLD_RATIO) continue;

    const averagePerDay = round1(average);
    deficits.push({
      key,
      label: LABELS[key],
      unit: UNITS[key],
      daysAnalyzed: trackedDays.length,
      averagePerDay,
      rda,
      deficitRatio,
      message: `Du hattest in den letzten ${trackedDays.length} Tagen im Schnitt nur ${averagePerDay}${UNITS[key]} ${LABELS[key]}/Tag. ${FOOD_SUGGESTIONS[key]}`,
      citation: CITATIONS[key],
    });
  }

  return deficits.sort((a, b) => b.deficitRatio - a.deficitRatio);
}
