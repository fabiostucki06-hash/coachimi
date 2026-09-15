import type { FoodItem, Macros, Micronutrients, NutrientKey, NutrientVisibility } from '../types';

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type Goal = 'weight_loss' | 'maintain' | 'muscle_gain' | 'endurance';
export type MacroRatioPreset = 'high_protein_low_carb' | 'balanced' | 'keto' | 'custom';
export type MicronutrientFocus = 'none' | 'iron' | 'fiber' | 'vitamins';
export type DietType = 'balanced' | 'keto' | 'vegan' | 'vegetarian' | 'carnivore' | 'low_carb' | 'high_protein' | 'fasting_focused';

export interface MacroRatio {
  protein: number;
  carbs: number;
  fat: number;
}

export interface BMRInput {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_ADJUSTMENTS_KCAL: Record<Goal, number> = {
  weight_loss: -500,
  maintain: 0,
  muscle_gain: 300,
  endurance: 200,
};

/** Fractions of daily calories (protein/carbs at 4 kcal/g, fat at 9 kcal/g). "custom" has no fixed values here — the caller resolves it to a user-entered MacroRatio. */
export const MACRO_RATIO_PRESET_VALUES: Record<Exclude<MacroRatioPreset, 'custom'>, MacroRatio> = {
  high_protein_low_carb: { protein: 0.4, carbs: 0.25, fat: 0.35 },
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  keto: { protein: 0.2, carbs: 0.05, fat: 0.75 },
};

/** Which nutrient keys a micronutrient focus reveals in the visibility selector by default. */
export const MICRONUTRIENT_FOCUS_KEYS: Record<Exclude<MicronutrientFocus, 'none'>, NutrientKey[]> = {
  iron: ['iron'],
  fiber: ['fiber'],
  vitamins: [
    'vitaminA',
    'vitaminB1',
    'vitaminB2',
    'vitaminB3',
    'vitaminB5',
    'vitaminB6',
    'vitaminB7',
    'vitaminB9',
    'vitaminB12',
    'vitaminC',
    'vitaminD',
    'vitaminE',
    'vitaminK',
  ],
};

/** Mifflin-St Jeor formula. */
export function calculateBMR({ age, gender, weightKg, heightCm }: BMRInput): number {
  if (age <= 0) throw new Error('age must be greater than 0');
  if (weightKg <= 0) throw new Error('weightKg must be greater than 0');
  if (heightCm <= 0) throw new Error('heightCm must be greater than 0');

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);
  throw new Error(`Unsupported gender: ${gender}`);
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  if (bmr <= 0) throw new Error('bmr must be greater than 0');
  const factor = ACTIVITY_FACTORS[activityLevel];
  if (factor === undefined) throw new Error(`Unsupported activity level: ${activityLevel}`);
  return Math.round(bmr * factor);
}

export function calculateDailyTargets(tdee: number, goal: Goal): number {
  if (tdee <= 0) throw new Error('tdee must be greater than 0');
  const adjustment = GOAL_ADJUSTMENTS_KCAL[goal];
  if (adjustment === undefined) throw new Error(`Unsupported goal: ${goal}`);
  return Math.round(tdee + adjustment);
}

export function calculateMacros(calories: number, ratio: MacroRatio = MACRO_RATIO_PRESET_VALUES.balanced): Macros {
  if (calories <= 0) throw new Error('calories must be greater than 0');
  return {
    protein: Math.round((calories * ratio.protein) / 4),
    carbs: Math.round((calories * ratio.carbs) / 4),
    fat: Math.round((calories * ratio.fat) / 9),
  };
}

/** Diets managed against NET carbs (total carbs minus fiber) rather than total carbs - the metric that actually governs ketosis/net-carb budgets. */
const NET_CARB_DIET_TYPES: ReadonlySet<DietType> = new Set(['keto', 'low_carb', 'carnivore']);

export function usesNetCarbs(dietType: DietType): boolean {
  return NET_CARB_DIET_TYPES.has(dietType);
}

export function getNetCarbs(carbsG: number, fiberG: number): number {
  return Math.max(carbsG - fiberG, 0);
}

/**
 * Re-derives a calorie total from already-rounded macro grams. `calculateMacros` rounds
 * each macro independently, so e.g. a 2200 kcal target can produce grams that sum back
 * to only 2197 kcal - callers that display both a calorie goal and its macro
 * breakdown should show this reconciled number instead of the pre-rounding target, so
 * the two never visibly disagree.
 */
export function caloriesFromMacros(macros: Macros): number {
  return Math.round(macros.carbs * 4 + macros.protein * 4 + macros.fat * 9);
}

/**
 * Reference daily intake (D-A-CH / IOM adult baseline) used as the progress-bar goal
 * for each micronutrient. Sodium/potassium are directional (sodium a ceiling, potassium
 * a floor) rather than a "fill the bar" target, but share the same progress-bar UI as
 * every other nutrient here - see components/features/NutrientProgress.tsx.
 *
 * iron/zinc/magnesium differ by sex under D-A-CH - this unisex fallback always takes
 * the HIGHER of the two sex-specific values (see GENDER_MICRONUTRIENT_GOALS) so a
 * user of unknown gender is never understated. Use getBaseMicronutrientGoals(gender)
 * wherever the user's actual gender is known instead of reading this directly.
 */
export const MICRONUTRIENT_GOALS: Required<Micronutrients> = {
  fiber: 30,
  sugar: 50,
  fructose: 25, // cautious daily ceiling (component of `sugar` above, not additional to it) - same "limit, not target" treatment as sugar/sodium
  saturatedFat: 20,
  unsaturatedFat: 44,
  cholesterol: 300,
  sodium: 2000, // D-A-CH ceiling, not a target to reach
  potassium: 4000, // D-A-CH minimum
  calcium: 1000,
  iron: 15, // unisex fallback = female D-A-CH value (higher of the two)
  magnesium: 350, // unisex fallback = male D-A-CH value (higher of the two)
  zinc: 11, // unisex fallback = male D-A-CH value (higher of the two)
  copper: 0.9,
  manganese: 2.3,
  selenium: 55,
  iodine: 150,
  vitaminA: 900,
  vitaminB1: 1.2,
  vitaminB2: 1.3,
  vitaminB3: 16,
  vitaminB5: 5,
  vitaminB6: 1.7,
  vitaminB7: 30,
  vitaminB9: 400,
  vitaminB12: 4.0,
  vitaminC: 90,
  vitaminD: 20, // 800 IU
  vitaminE: 15,
  vitaminK: 120,
};

/** D-A-CH values for the three micronutrients with a sex-specific reference intake - overlaid onto MICRONUTRIENT_GOALS by getBaseMicronutrientGoals once the user's gender is known. */
const GENDER_MICRONUTRIENT_GOALS: Record<Gender, Pick<Micronutrients, 'iron' | 'zinc' | 'magnesium'>> = {
  male: { iron: 10, zinc: 11, magnesium: 350 },
  female: { iron: 15, zinc: 8, magnesium: 300 },
};

/** MICRONUTRIENT_GOALS with iron/zinc/magnesium swapped to the D-A-CH value for `gender` - the unisex fallback (higher-of-both) stays in place when gender is unknown. Diet-specific bioavailability multipliers (vegan/vegetarian iron+zinc, keto/low_carb/carnivore/high_protein electrolytes, carnivore/keto fiber) layer on top via services/dietEngine.ts's getMicronutrientGoalsForDiet. */
export function getBaseMicronutrientGoals(gender: Gender | undefined): Required<Micronutrients> {
  if (!gender) return MICRONUTRIENT_GOALS;
  return { ...MICRONUTRIENT_GOALS, ...GENDER_MICRONUTRIENT_GOALS[gender] };
}

const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENT_GOALS) as (keyof Micronutrients)[];

/**
 * `sugar` (USDA nutrient 2000 "Sugars, total including NLEA", FatSecret's/OFF's
 * `sugar`/`sugars_100g`) is already a TOTAL that `fructose` (its own tracked field -
 * see the Micronutrients interface) is one component of, not a disjoint "other sugars"
 * figure - so `fructose` is stored ALONGSIDE `sugar`, never added on top of it
 * (that would double-count it: an apple's ~10g total sugar would wrongly balloon to
 * ~16g by re-adding its ~6g fructose). This function resolves the TOTAL only: prefer
 * the source's own total when it reports one, and only fall back to the fructose
 * figure alone when the source has no total sugar value at all (better than silently
 * dropping the only sugar figure available). A `sugar` of exactly 0 is treated the
 * same as missing here: sugar is a strict superset of fructose, so a source reporting
 * 0 total sugar alongside a nonzero fructose is an inconsistent/unpopulated field
 * rather than a genuine zero, and the fructose figure is the more trustworthy one.
 * Used where a raw API response has sugar and fructose as two separate numbers,
 * before both are written into a FoodItem's micronutrientsPerServing (sugar via this
 * function, fructose stored as-is alongside it).
 */
export function foldFructoseIntoSugar(sugar: number | undefined, fructose: number | undefined): number | undefined {
  if (sugar) return sugar;
  return fructose ?? sugar;
}

/**
 * Same fold, applied to an already-assembled micronutrients object (e.g. a jsonb
 * blob read back from the local `foods`/`community_barcodes` tables) whose `sugar`
 * might be missing while `fructose` is present - reconciles `sugar` to the coherent
 * total (see foldFructoseIntoSugar) while leaving `fructose` itself in the object
 * untouched, so it stays visible as its own field rather than being dropped.
 */
export function withFructoseFoldedIntoSugar(micronutrients: Micronutrients | null | undefined): Micronutrients {
  const source = micronutrients ?? {};
  if (source.fructose === undefined) return source;
  return { ...source, sugar: foldFructoseIntoSugar(source.sugar, source.fructose) };
}

// German+English fruit/berry/honey keywords - not exhaustive, just the common produce a
// meal photo or manual food entry is likely to involve. Same keyword-matching pattern
// services/dietEngine.ts's diet-compliance checks already use.
const FRUIT_LIKE_KEYWORDS = [
  'apfel', 'banane', 'orange', 'erdbeere', 'blaubeere', 'himbeere', 'traube', 'wassermelone',
  'melone', 'birne', 'pfirsich', 'kirsche', 'ananas', 'mango', 'kiwi', 'zitrone', 'limette',
  'beere', 'obst', 'honig', 'dattel', 'feige', 'aprikose', 'pflaume', 'rosine', 'trockenfrucht',
  'apple', 'banana', 'strawberr', 'blueberr', 'raspberr', 'grape', 'watermelon', 'melon',
  'pear', 'peach', 'cherr', 'pineapple', 'kiwi', 'lemon', 'lime', 'berry', 'fruit',
  'honey', 'date', 'fig', 'apricot', 'plum', 'raisin',
];

/** True if `name` looks like a fruit/berry/honey item - drives the ~50%-of-sugar fructose fallback below. Keyword-based, not authoritative. */
export function looksLikeFruit(name: string): boolean {
  const haystack = name.toLowerCase();
  return FRUIT_LIKE_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Fallback for a fruit/berry/honey item whose source has a sugar figure but no
 * specific fructose breakdown of its own: fructose is conservatively estimated at
 * ~50% of total sugar rather than left at 0 (fruit sugar is fructose-heavy - roughly
 * half-and-half with glucose/sucrose for most common fruit, so this is a reasonable
 * default, not a precise lab value). Returns 0 for anything that doesn't look like
 * fruit/berry/honey, or when sugar itself is 0/unknown - never guesses a fructose
 * value for a food with no sugar to begin with. Used by services/visionFoodApi.ts
 * (AI estimates) and data/foodDatabase.ts (local seed data) wherever a specific
 * fructose figure isn't available.
 */
export function estimateFructoseFromSugar(name: string, sugar: number | undefined): number {
  if (!sugar || sugar <= 0 || !looksLikeFruit(name)) return 0;
  return Math.round(sugar * 0.5 * 10) / 10;
}

/**
 * FatSecret's `food.get` reports calcium/iron/vitamin A/vitamin C on a serving as a
 * percentage of the (US FDA) recommended Daily Value rather than an absolute amount,
 * unlike every other nutrient it returns (and unlike USDA/OFF, which are already
 * absolute mg/µg). `MICRONUTRIENT_GOALS` above already tracks this app's own
 * reference Daily Value for each of those nutrients, so it doubles as the
 * conversion basis here instead of duplicating the same numbers a second time.
 */
export function percentDvToAmount(percentDv: number | undefined, referenceDv: number): number | undefined {
  return percentDv === undefined ? undefined : (percentDv / 100) * referenceDv;
}

type ScalableFood = Pick<FoodItem, 'caloriesPerServing' | 'macrosPerServing' | 'micronutrientsPerServing' | 'servingSize'>;

export interface ScaledNutrients {
  calories: number;
  macros: Macros;
  micronutrients: Required<Micronutrients>;
}

/** Multiplies every macro/micronutrient of a food by `factor`, defaulting any missing micronutrient to 0 so downstream math (sums, %DV bars) never has to guard against `undefined` itself. */
function scaleByFactor(food: ScalableFood, factor: number): ScaledNutrients {
  const { macrosPerServing, micronutrientsPerServing } = food;
  const micronutrients = {} as Required<Micronutrients>;
  for (const key of MICRONUTRIENT_KEYS) {
    micronutrients[key] = (micronutrientsPerServing[key] ?? 0) * factor;
  }
  return {
    calories: food.caloriesPerServing * factor,
    macros: {
      carbs: macrosPerServing.carbs * factor,
      protein: macrosPerServing.protein * factor,
      fat: macrosPerServing.fat * factor,
    },
    micronutrients,
  };
}

/**
 * Unified scaling engine: `(valuePer100g * weightGrams) / 100`, generalized to the
 * food's own base serving size (almost always 100g, but not assumed to be) so every
 * macro AND micronutrient scales together from one call - portion shortcuts and
 * custom gram inputs both route through this so a preview can never show macros and
 * micros computed from two different code paths going out of sync.
 */
export function calculateScaledNutrients(food: ScalableFood, weightGrams: number): ScaledNutrients {
  const baseSize = food.servingSize || 100;
  return scaleByFactor(food, weightGrams / baseSize);
}

/** Same engine expressed as a serving multiplier - used for logged diary entries, which store `servings` rather than a raw gram amount (gram-based foods just have `servings = grams / servingSize` already baked in). */
export function scaleNutrientsByServings(food: ScalableFood, servings: number): ScaledNutrients {
  return scaleByFactor(food, servings);
}

export const DEFAULT_VISIBLE_NUTRIENTS: NutrientVisibility = {
  carbs: true,
  protein: true,
  fat: true,
  fiber: false,
  sugar: false,
  fructose: false,
  saturatedFat: false,
  unsaturatedFat: false,
  cholesterol: false,
  sodium: false,
  potassium: false,
  calcium: false,
  iron: false,
  magnesium: false,
  zinc: false,
  copper: false,
  manganese: false,
  selenium: false,
  iodine: false,
  vitaminA: false,
  vitaminB1: false,
  vitaminB2: false,
  vitaminB3: false,
  vitaminB5: false,
  vitaminB6: false,
  vitaminB7: false,
  vitaminB9: false,
  vitaminB12: false,
  vitaminC: false,
  vitaminD: false,
  vitaminE: false,
  vitaminK: false,
};
