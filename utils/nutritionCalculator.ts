import type { FoodItem, Macros, Micronutrients, NutrientKey, NutrientVisibility } from '../types';

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type Goal = 'weight_loss' | 'maintain' | 'muscle_gain' | 'endurance';
export type MacroRatioPreset = 'high_protein_low_carb' | 'balanced' | 'keto' | 'custom';
export type MicronutrientFocus = 'none' | 'iron' | 'fiber' | 'vitamins';

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

/** Reference daily intake (standard adult %DV) used as the progress-bar goal for each micronutrient. */
export const MICRONUTRIENT_GOALS: Required<Micronutrients> = {
  fiber: 30,
  sugar: 50,
  saturatedFat: 20,
  unsaturatedFat: 44,
  cholesterol: 300,
  sodium: 2300,
  potassium: 3500,
  calcium: 1300,
  iron: 18,
  magnesium: 420,
  zinc: 11,
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
  vitaminB12: 2.4,
  vitaminC: 90,
  vitaminD: 20,
  vitaminE: 15,
  vitaminK: 120,
};

const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENT_GOALS) as (keyof Micronutrients)[];

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
