import type { FoodItem, Macros } from '@/types';
import {
  calculateMacros,
  calculateScaledNutrients,
  MICRONUTRIENT_GOALS,
  type ActivityLevel,
  type DietType,
  type MacroRatio,
} from '@/utils/nutritionCalculator';

/**
 * Target macro split per diet type - descriptive %-of-calories reference AND, for the
 * diets that aren't weight-pinned (see calculateDietMacros below), the actual split
 * used. Percentages of daily calories, protein/carbs at 4 kcal/g, fat at 9 kcal/g.
 * Evidence base: ISSN position stands (protein/kg ranges) + IOM/D-A-CH reference
 * intakes (iron). Protein % here is documentation only for diets that are weight-pinned
 * (see DIET_PROTEIN_G_PER_KG) - carbs/fat are what those diets actually read from here.
 */
export const DIET_MACRO_RATIOS: Record<DietType, MacroRatio> = {
  balanced: { protein: 0.2, carbs: 0.5, fat: 0.3 },
  keto: { protein: 0.2, carbs: 0.05, fat: 0.75 },
  vegan: { protein: 0.2, carbs: 0.55, fat: 0.25 },
  vegetarian: { protein: 0.2, carbs: 0.5, fat: 0.3 },
  carnivore: { protein: 0.35, carbs: 0, fat: 0.65 },
  low_carb: { protein: 0.3, carbs: 0.2, fat: 0.5 },
  high_protein: { protein: 0.35, carbs: 0.4, fat: 0.25 },
  fasting_focused: { protein: 0.25, carbs: 0.45, fat: 0.3 },
};

export function getMacroRatioForDiet(dietType: DietType): MacroRatio {
  return DIET_MACRO_RATIOS[dietType] ?? DIET_MACRO_RATIOS.balanced;
}

// --- Weight-pinned protein targets ---------------------------------------------------
//
// A fixed %-of-calories protein target makes protein grams swing with calorie target
// alone - a 60kg and 120kg user on the same 2000 kcal target would get the same
// protein. Every diet except fasting_focused (which has no ISSN-backed g/kg figure of
// its own, so it stays a plain 45/25/30 split) instead pins protein directly to body
// weight, then fills the rest of the calorie budget with carbs/fat.

/** g protein / kg bodyweight, fixed value or midpoint of the diet's ISSN/D-A-CH range. Carnivore/High-Protein instead scale by activity level - see HIGH_PROTEIN_MULTIPLIER_BY_ACTIVITY. */
export const DIET_PROTEIN_G_PER_KG: Partial<Record<DietType, number>> = {
  balanced: 1.2,
  vegetarian: 1.2,
  vegan: 1.3, // 1.2-1.4g/kg range, offsets lower plant-protein bioavailability
  keto: 1.4, // 1.3-1.5g/kg range, high enough to preserve muscle without enough protein to blunt ketosis
  low_carb: 1.8,
};

/** g protein / kg bodyweight for diets sharing the 2.0x-2.5x range (Carnivore, High-Protein), by activity level. 2.2x (moderate) is the default. */
export const HIGH_PROTEIN_MULTIPLIER_BY_ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 2.0,
  light: 2.1,
  moderate: 2.2,
  active: 2.5,
};

export const HIGH_PROTEIN_DEFAULT_MULTIPLIER = HIGH_PROTEIN_MULTIPLIER_BY_ACTIVITY.moderate;

/** Keto: net carbs capped at whichever is stricter of these two. */
export const KETO_DAILY_CARB_PERCENT = 0.05;
export const KETO_DAILY_CARB_CAP_G = 30;

/** Low Carb: carbs capped at whichever is stricter of these two. */
export const LOW_CARB_DAILY_CARB_PERCENT = 0.2;
export const LOW_CARB_DAILY_CARB_CAP_G = 100;

/** Carnivore: strictly animal sources - target is 0g, this is only the outer allowance a trace plant ingredient (spices, broth) is tolerated under. */
export const CARNIVORE_DAILY_CARB_CAP_G = 10;

/**
 * High-Protein macro target: protein (g) = weightKg * activity-scaled multiplier
 * (2.0x-2.5x), then the calories left in `targetCalories` after that protein
 * allocation split into carbs/fat using high_protein's carb:fat proportion (not its
 * protein share, which this function replaces entirely).
 */
export function calculateHighProteinMacros(targetCalories: number, weightKg: number, activityLevel: ActivityLevel): Macros {
  if (targetCalories <= 0) throw new Error('targetCalories must be greater than 0');
  if (weightKg <= 0) throw new Error('weightKg must be greater than 0');

  const multiplier = HIGH_PROTEIN_MULTIPLIER_BY_ACTIVITY[activityLevel] ?? HIGH_PROTEIN_DEFAULT_MULTIPLIER;
  const protein = Math.round(weightKg * multiplier);
  const remainingCalories = Math.max(targetCalories - protein * 4, 0);

  const { carbs: carbShare, fat: fatShare } = DIET_MACRO_RATIOS.high_protein;
  const nonProteinShareSum = carbShare + fatShare;
  const carbs = Math.round((remainingCalories * (carbShare / nonProteinShareSum)) / 4);
  const fat = Math.round((remainingCalories * (fatShare / nonProteinShareSum)) / 9);

  return { protein, carbs, fat };
}

/**
 * Single entry point for a diet's daily macro target - the one function
 * store/userStore.ts and the onboarding preview should call. Dispatches to the right
 * formula per diet: weight-pinned protein + a carb cap for keto/low_carb/carnivore
 * (fat absorbs whatever calories are left), weight-pinned protein + a carb:fat ratio
 * split for balanced/vegan/vegetarian/high_protein, and a plain %-of-calories ratio
 * for fasting_focused (no ISSN g/kg figure of its own).
 */
export function calculateDietMacros(dietType: DietType, targetCalories: number, weightKg: number, activityLevel: ActivityLevel): Macros {
  if (targetCalories <= 0) throw new Error('targetCalories must be greater than 0');
  if (weightKg <= 0) throw new Error('weightKg must be greater than 0');

  switch (dietType) {
    case 'fasting_focused':
      return calculateMacros(targetCalories, DIET_MACRO_RATIOS.fasting_focused);

    case 'keto': {
      const protein = Math.round(weightKg * (DIET_PROTEIN_G_PER_KG.keto ?? 1.4));
      const carbs = Math.min(KETO_DAILY_CARB_CAP_G, Math.round((targetCalories * KETO_DAILY_CARB_PERCENT) / 4));
      const fat = Math.round(Math.max(targetCalories - protein * 4 - carbs * 4, 0) / 9);
      return { protein, carbs, fat };
    }

    case 'low_carb': {
      const protein = Math.round(weightKg * (DIET_PROTEIN_G_PER_KG.low_carb ?? 1.8));
      const carbs = Math.min(LOW_CARB_DAILY_CARB_CAP_G, Math.round((targetCalories * LOW_CARB_DAILY_CARB_PERCENT) / 4));
      const fat = Math.round(Math.max(targetCalories - protein * 4 - carbs * 4, 0) / 9);
      return { protein, carbs, fat };
    }

    case 'carnivore': {
      const multiplier = HIGH_PROTEIN_MULTIPLIER_BY_ACTIVITY[activityLevel] ?? HIGH_PROTEIN_DEFAULT_MULTIPLIER;
      const protein = Math.round(weightKg * multiplier);
      const carbs = 0;
      const fat = Math.round(Math.max(targetCalories - protein * 4 - carbs * 4, 0) / 9);
      return { protein, carbs, fat };
    }

    case 'high_protein':
      return calculateHighProteinMacros(targetCalories, weightKg, activityLevel);

    case 'balanced':
    case 'vegan':
    case 'vegetarian':
    default: {
      const gPerKg = DIET_PROTEIN_G_PER_KG[dietType] ?? DIET_PROTEIN_G_PER_KG.balanced ?? 1.2;
      const protein = Math.round(weightKg * gPerKg);
      const remainingCalories = Math.max(targetCalories - protein * 4, 0);
      const { carbs: carbShare, fat: fatShare } = DIET_MACRO_RATIOS[dietType] ?? DIET_MACRO_RATIOS.balanced;
      const shareSum = carbShare + fatShare;
      const carbs = Math.round((remainingCalories * (carbShare / shareSum)) / 4);
      const fat = Math.round((remainingCalories * (fatShare / shareSum)) / 9);
      return { protein, carbs, fat };
    }
  }
}

// --- Iron target scaling (non-heme absorption) ---------------------------------------
//
// Plant-forward diets draw most or all of their iron from non-heme sources, which the
// body absorbs far less efficiently than the heme iron in meat/fish - IOM guidance
// scales the reference intake up to compensate. Vegan excludes ALL animal iron
// (heme + non-heme) so gets the larger bump; vegetarian still has dairy/egg non-heme
// iron, hence the smaller one.
export const IRON_GOAL_MULTIPLIER: Partial<Record<DietType, number>> = {
  vegan: 1.8,
  vegetarian: 1.5,
};

/** Daily iron target (mg) for a diet - MICRONUTRIENT_GOALS.iron scaled by IRON_GOAL_MULTIPLIER where one applies. Use this (not MICRONUTRIENT_GOALS.iron directly) anywhere a user's iron goal is displayed. */
export function getIronGoalForDiet(dietType: DietType): number {
  const multiplier = IRON_GOAL_MULTIPLIER[dietType] ?? 1;
  return Math.round(MICRONUTRIENT_GOALS.iron * multiplier * 10) / 10;
}

/** Short, user-facing summary of a diet's headline target(s) - for the "what does this diet actually do" hint next to the diet picker. */
export function getDietTargetSummary(dietType: DietType): string {
  switch (dietType) {
    case 'balanced':
      return 'Ausgewogen: 50% Carbs • 1.2g/kg Protein • 30% Fett';
    case 'keto':
      return `Keto: Max ${KETO_DAILY_CARB_CAP_G}g Carbs • High Fat`;
    case 'vegan':
      return `Vegan: +${Math.round((IRON_GOAL_MULTIPLIER.vegan! - 1) * 100)}% Eisen-Ziel angepasst`;
    case 'vegetarian':
      return `Vegetarisch: +${Math.round((IRON_GOAL_MULTIPLIER.vegetarian! - 1) * 100)}% Eisen-Ziel angepasst`;
    case 'carnivore':
      return `Carnivore: 0-${CARNIVORE_DAILY_CARB_CAP_G}g Carbs • 2.0-2.5g/kg Protein`;
    case 'low_carb':
      return `Low Carb: Max ${LOW_CARB_DAILY_CARB_CAP_G}g Carbs`;
    case 'high_protein':
      return 'High Protein: ~2.2g/kg Protein (2.0-2.5g/kg)';
    case 'fasting_focused':
      return 'Intervallfasten-Fokus: 45% Carbs • 25% Protein • 30% Fett (16:8/18:6-Fenster)';
    default:
      return '';
  }
}

// --- MND (Macro-Nutrient-Density) score ---------------------------------------------
//
// A 0-100 heuristic (not medical advice, same spirit as utils/supplementEngine.ts)
// scoring how well a food fits the *selected diet* - not a generic "healthy food"
// score. The same food can score very differently under two diets: whole milk is
// penalized for a keto/carnivore user's zero-carb goal but boosted for a
// vegetarian's calcium/B12 gap.

/** carbs/100g at or above this is treated as a plant-carb staple - incompatible with carnivore's zero-carb rule regardless of name. Also the MND score's per-diet carb-overage penalty threshold (see DIET_MND_PROFILES). */
const CARNIVORE_CARB_LIMIT_G = 5;
const KETO_CARB_LIMIT_G = 10;
const LOW_CARB_CARB_LIMIT_G = 20;

interface DietMndProfile {
  /** Micronutrients this diet is most at risk of running short on - their %-of-goal coverage counts double toward the density score. */
  priorityMicros: (keyof typeof MICRONUTRIENT_GOALS)[];
  /** Subset of priorityMicros this diet is most CLINICALLY at risk on (e.g. iron/B12 on a plant-only diet) - counts triple instead of double. */
  criticalMicros: (keyof typeof MICRONUTRIENT_GOALS)[];
  /** Multiplier on the sugar/sodium penalty - diets built around avoiding processed carbs penalize harder. */
  penaltyWeight: number;
  /** Multiplier on the saturated-fat penalty - 0 for fat-forward diets (keto/low-carb/carnivore), where dietary fat is the point of the diet, not a risk to penalize. */
  fatPenaltyWeight: number;
  /** carbs/100g above this is penalized heavily - Infinity disables (diets with no carb ceiling). */
  carbOverageThresholdG: number;
  /** Multiplier on the above-threshold carb penalty. */
  carbOveragePenaltyWeight: number;
  /** Multiplier on a bonus for how large a share of the food's calories come from carbs being LOW - 0 disables (macro-agnostic diets). */
  lowCarbBonusWeight: number;
  /** Multiplier on a bonus for how large a share of the food's calories come from protein - 0 disables. */
  proteinBonusWeight: number;
  /** Multiplier on a bonus for low calorie-density (kcal per 100g) - only meaningful for a diet built around a shrunk eating window. */
  calorieEfficiencyWeight: number;
}

const DIET_MND_PROFILES: Record<DietType, DietMndProfile> = {
  balanced: {
    priorityMicros: [], criticalMicros: [], penaltyWeight: 1, fatPenaltyWeight: 1,
    carbOverageThresholdG: Infinity, carbOveragePenaltyWeight: 0, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0,
  },
  keto: {
    priorityMicros: ['magnesium', 'potassium'], criticalMicros: [], penaltyWeight: 2, fatPenaltyWeight: 0,
    carbOverageThresholdG: KETO_CARB_LIMIT_G, carbOveragePenaltyWeight: 1.5, lowCarbBonusWeight: 2, proteinBonusWeight: 0, calorieEfficiencyWeight: 0,
  },
  low_carb: {
    priorityMicros: ['fiber', 'potassium'], criticalMicros: [], penaltyWeight: 1.5, fatPenaltyWeight: 0,
    carbOverageThresholdG: LOW_CARB_CARB_LIMIT_G, carbOveragePenaltyWeight: 1, lowCarbBonusWeight: 1.5, proteinBonusWeight: 0, calorieEfficiencyWeight: 0,
  },
  carnivore: {
    priorityMicros: ['iron', 'vitaminB12', 'zinc'], criticalMicros: [], penaltyWeight: 2, fatPenaltyWeight: 0,
    carbOverageThresholdG: CARNIVORE_CARB_LIMIT_G, carbOveragePenaltyWeight: 1.5, lowCarbBonusWeight: 2.5, proteinBonusWeight: 1, calorieEfficiencyWeight: 0,
  },
  vegan: {
    priorityMicros: ['iron', 'vitaminB12', 'calcium', 'zinc'], criticalMicros: ['iron', 'vitaminB12'], penaltyWeight: 1, fatPenaltyWeight: 1,
    carbOverageThresholdG: Infinity, carbOveragePenaltyWeight: 0, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0,
  },
  vegetarian: {
    priorityMicros: ['iron', 'vitaminB12', 'calcium'], criticalMicros: ['iron', 'vitaminB12'], penaltyWeight: 1, fatPenaltyWeight: 1,
    carbOverageThresholdG: Infinity, carbOveragePenaltyWeight: 0, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0,
  },
  high_protein: {
    // proteinBonusWeight doubled (2 -> 4): protein density per kcal counts twice as hard toward this diet's score as the baseline weighting below gives it.
    priorityMicros: ['iron', 'zinc', 'magnesium'], criticalMicros: [], penaltyWeight: 1, fatPenaltyWeight: 1,
    carbOverageThresholdG: Infinity, carbOveragePenaltyWeight: 0, lowCarbBonusWeight: 0, proteinBonusWeight: 4, calorieEfficiencyWeight: 0,
  },
  fasting_focused: {
    priorityMicros: ['potassium', 'magnesium'], criticalMicros: [], penaltyWeight: 1.5, fatPenaltyWeight: 1.5,
    carbOverageThresholdG: Infinity, carbOveragePenaltyWeight: 0, lowCarbBonusWeight: 0, proteinBonusWeight: 0.5, calorieEfficiencyWeight: 2,
  },
};

const MND_MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENT_GOALS) as (keyof typeof MICRONUTRIENT_GOALS)[];

/** Below this per-100g calorie density, `calorieEfficiencyWeight` gives its full bonus; scales down linearly to 0 at/above it. */
const CALORIE_EFFICIENCY_CEILING_KCAL = 200;

/** MND score for one food under a given diet, 0 (poor fit) - 100 (excellent fit). Always normalizes to per-100g first so foods with different serving sizes compare fairly. */
export function calculateMndScore(food: FoodItem, dietType: DietType): number {
  const profile = DIET_MND_PROFILES[dietType] ?? DIET_MND_PROFILES.balanced;
  const per100 = calculateScaledNutrients(food, 100);
  const calories = Math.max(per100.calories, 1);

  let microCoverageSum = 0;
  let microWeightSum = 0;
  for (const key of MND_MICRONUTRIENT_KEYS) {
    const goal = MICRONUTRIENT_GOALS[key];
    if (!goal) continue;
    const weight = profile.criticalMicros.includes(key) ? 3 : profile.priorityMicros.includes(key) ? 2 : 1;
    const coverage = Math.min(per100.micronutrients[key] / goal, 1);
    microCoverageSum += coverage * weight;
    microWeightSum += weight;
  }
  const microScore = microWeightSum > 0 ? (microCoverageSum / microWeightSum) * 100 : 0;

  const sugarPenalty = Math.min(per100.micronutrients.sugar / MICRONUTRIENT_GOALS.sugar, 1) * 20 * profile.penaltyWeight;
  const satFatPenalty = Math.min(per100.micronutrients.saturatedFat / MICRONUTRIENT_GOALS.saturatedFat, 1) * 10 * profile.fatPenaltyWeight;
  const sodiumPenalty = Math.min(per100.micronutrients.sodium / MICRONUTRIENT_GOALS.sodium, 1) * 10 * profile.penaltyWeight;
  const carbOveragePenalty =
    per100.macros.carbs > profile.carbOverageThresholdG
      ? Math.min((per100.macros.carbs - profile.carbOverageThresholdG) / profile.carbOverageThresholdG, 1) * 25 * profile.carbOveragePenaltyWeight
      : 0;

  const carbCalorieShare = (per100.macros.carbs * 4) / calories;
  const proteinCalorieShare = (per100.macros.protein * 4) / calories;
  const lowCarbBonus = (1 - carbCalorieShare) * 15 * profile.lowCarbBonusWeight;
  const proteinBonus = proteinCalorieShare * 20 * profile.proteinBonusWeight;
  const calorieEfficiencyBonus =
    (Math.max(CALORIE_EFFICIENCY_CEILING_KCAL - per100.calories, 0) / CALORIE_EFFICIENCY_CEILING_KCAL) * 10 * profile.calorieEfficiencyWeight;

  const raw =
    microScore - sugarPenalty - satFatPenalty - sodiumPenalty - carbOveragePenalty + lowCarbBonus + proteinBonus + calorieEfficiencyBonus;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// --- Diet compliance flag ------------------------------------------------------------
//
// Foods have no diet tags of their own (local DB, USDA and FatSecret hits all lack
// one), so compliance is inferred: keyword matching against the (German-first, since
// the app's own copy and search queries are German) name/brand for animal-product
// diets, and per-100g carb thresholds for carb-restrictive diets. Heuristic, not
// authoritative - flags what to prioritize/de-prioritize in a search result list, not
// a hard filter (see rankFoodsForDiet), so a false positive just re-orders a list
// rather than hiding a food outright.

export type DietComplianceFlag = 'priority' | 'neutral' | 'avoid';

const MEAT_FISH_KEYWORDS = [
  'fleisch', 'huhn', 'hähnchen', 'hahn', 'rind', 'schwein', 'pute', 'truthahn', 'lamm', 'wild',
  'wurst', 'speck', 'schinken', 'salami', 'bacon', 'fisch', 'lachs', 'thunfisch', 'garnelen', 'krabbe',
  'meeresfrüchte', 'meat', 'chicken', 'beef', 'pork', 'turkey', 'lamb', 'ham', 'sausage', 'fish',
  'salmon', 'tuna', 'shrimp', 'seafood', 'gelatine', 'gelatin',
];

const DAIRY_EGG_KEYWORDS = [
  'ei', 'eier', 'milch', 'käse', 'joghurt', 'quark', 'sahne', 'butter', 'honig',
  'egg', 'milk', 'cheese', 'yogurt', 'cream', 'butter', 'honey',
];

const ANIMAL_KEYWORDS = [...MEAT_FISH_KEYWORDS, ...DAIRY_EGG_KEYWORDS];

function matchesKeyword(food: FoodItem, keywords: string[]): boolean {
  const haystack = `${food.name} ${food.brand ?? ''}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

/** How well one food fits a diet - used to sort search results (see rankFoodsForDiet), not to hide anything. */
export function getDietCompliance(food: FoodItem, dietType: DietType): DietComplianceFlag {
  const per100 = calculateScaledNutrients(food, 100);
  const carbsPer100 = per100.macros.carbs;

  switch (dietType) {
    case 'vegan':
      return matchesKeyword(food, ANIMAL_KEYWORDS) ? 'avoid' : 'priority';
    case 'vegetarian':
      return matchesKeyword(food, MEAT_FISH_KEYWORDS) ? 'avoid' : 'priority';
    case 'carnivore':
      if (carbsPer100 >= CARNIVORE_CARB_LIMIT_G) return 'avoid';
      return matchesKeyword(food, MEAT_FISH_KEYWORDS) || matchesKeyword(food, DAIRY_EGG_KEYWORDS) ? 'priority' : 'neutral';
    case 'keto':
      return carbsPer100 <= KETO_CARB_LIMIT_G ? 'priority' : carbsPer100 <= LOW_CARB_CARB_LIMIT_G ? 'neutral' : 'avoid';
    case 'low_carb':
      return carbsPer100 <= LOW_CARB_CARB_LIMIT_G ? 'priority' : carbsPer100 <= LOW_CARB_CARB_LIMIT_G * 2 ? 'neutral' : 'avoid';
    case 'high_protein': {
      const proteinShare = (per100.macros.protein * 4) / Math.max(per100.calories, 1);
      return proteinShare >= 0.25 ? 'priority' : proteinShare >= 0.15 ? 'neutral' : 'avoid';
    }
    case 'fasting_focused':
    case 'balanced':
    default:
      return 'neutral';
  }
}

const COMPLIANCE_ORDER: Record<DietComplianceFlag, number> = { priority: 0, neutral: 1, avoid: 2 };

/**
 * Re-orders search results for the user's diet: compliant/priority foods first, foods
 * to avoid last, MND score breaking ties within each group. Stable, non-destructive -
 * every food from `foods` is still present, just re-sorted, so a diet mismatch never
 * makes a food impossible to find, only less prominent.
 */
export function rankFoodsForDiet(foods: FoodItem[], dietType: DietType): FoodItem[] {
  return [...foods]
    .map((food) => ({ food, compliance: getDietCompliance(food, dietType), score: calculateMndScore(food, dietType) }))
    .sort((a, b) => COMPLIANCE_ORDER[a.compliance] - COMPLIANCE_ORDER[b.compliance] || b.score - a.score)
    .map((entry) => entry.food);
}
