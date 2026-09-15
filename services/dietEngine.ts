import type { FoodItem } from '@/types';
import { calculateScaledNutrients, MICRONUTRIENT_GOALS, type DietType, type MacroRatio } from '@/utils/nutritionCalculator';

/** Target macro split per diet type - the single source of truth macro targets recalibrate from whenever `dietType` changes (see store/userStore.ts's updateProfile/setDietType). Percentages of daily calories, protein/carbs at 4 kcal/g, fat at 9 kcal/g. */
export const DIET_MACRO_RATIOS: Record<DietType, MacroRatio> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  keto: { protein: 0.2, carbs: 0.05, fat: 0.75 },
  vegan: { protein: 0.25, carbs: 0.5, fat: 0.25 },
  vegetarian: { protein: 0.25, carbs: 0.45, fat: 0.3 },
  carnivore: { protein: 0.35, carbs: 0.02, fat: 0.63 },
  low_carb: { protein: 0.35, carbs: 0.2, fat: 0.45 },
  high_protein: { protein: 0.4, carbs: 0.35, fat: 0.25 },
  fasting_focused: { protein: 0.3, carbs: 0.35, fat: 0.35 },
};

export function getMacroRatioForDiet(dietType: DietType): MacroRatio {
  return DIET_MACRO_RATIOS[dietType] ?? DIET_MACRO_RATIOS.balanced;
}

// --- MND (Macro-Nutrient-Density) score ---------------------------------------------
//
// A 0-100 heuristic (not medical advice, same spirit as utils/supplementEngine.ts)
// scoring how well a food fits the *selected diet* - not a generic "healthy food"
// score. The same food can score very differently under two diets: whole milk is
// penalized for a keto/carnivore user's zero-carb goal but boosted for a
// vegetarian's calcium/B12 gap.

interface DietMndProfile {
  /** Micronutrients this diet is most at risk of running short on - their %-of-goal coverage counts double toward the density score. */
  priorityMicros: (keyof typeof MICRONUTRIENT_GOALS)[];
  /** Multiplier on the sugar/saturated-fat/sodium penalty - diets built around avoiding processed carbs/fat penalize harder. */
  penaltyWeight: number;
  /** Multiplier on a bonus for how large a share of the food's calories come from carbs being LOW - 0 disables (macro-agnostic diets). */
  lowCarbBonusWeight: number;
  /** Multiplier on a bonus for how large a share of the food's calories come from protein - 0 disables. */
  proteinBonusWeight: number;
  /** Multiplier on a bonus for low calorie-density (kcal per 100g) - only meaningful for a diet built around a shrunk eating window. */
  calorieEfficiencyWeight: number;
}

const DIET_MND_PROFILES: Record<DietType, DietMndProfile> = {
  balanced: { priorityMicros: [], penaltyWeight: 1, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0 },
  keto: { priorityMicros: ['magnesium', 'potassium'], penaltyWeight: 2, lowCarbBonusWeight: 2, proteinBonusWeight: 0, calorieEfficiencyWeight: 0 },
  low_carb: { priorityMicros: ['fiber', 'potassium'], penaltyWeight: 1.5, lowCarbBonusWeight: 1.5, proteinBonusWeight: 0, calorieEfficiencyWeight: 0 },
  carnivore: { priorityMicros: ['iron', 'vitaminB12', 'zinc'], penaltyWeight: 2, lowCarbBonusWeight: 2.5, proteinBonusWeight: 1, calorieEfficiencyWeight: 0 },
  vegan: { priorityMicros: ['iron', 'vitaminB12', 'calcium', 'zinc'], penaltyWeight: 1, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0 },
  vegetarian: { priorityMicros: ['iron', 'vitaminB12', 'calcium'], penaltyWeight: 1, lowCarbBonusWeight: 0, proteinBonusWeight: 0, calorieEfficiencyWeight: 0 },
  high_protein: { priorityMicros: ['iron', 'zinc', 'magnesium'], penaltyWeight: 1, lowCarbBonusWeight: 0, proteinBonusWeight: 2, calorieEfficiencyWeight: 0 },
  fasting_focused: { priorityMicros: ['potassium', 'magnesium'], penaltyWeight: 1.5, lowCarbBonusWeight: 0, proteinBonusWeight: 0.5, calorieEfficiencyWeight: 2 },
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
    const weight = profile.priorityMicros.includes(key) ? 2 : 1;
    const coverage = Math.min(per100.micronutrients[key] / goal, 1);
    microCoverageSum += coverage * weight;
    microWeightSum += weight;
  }
  const microScore = microWeightSum > 0 ? (microCoverageSum / microWeightSum) * 100 : 0;

  const sugarPenalty = Math.min(per100.micronutrients.sugar / MICRONUTRIENT_GOALS.sugar, 1) * 20 * profile.penaltyWeight;
  const satFatPenalty = Math.min(per100.micronutrients.saturatedFat / MICRONUTRIENT_GOALS.saturatedFat, 1) * 10 * profile.penaltyWeight;
  const sodiumPenalty = Math.min(per100.micronutrients.sodium / MICRONUTRIENT_GOALS.sodium, 1) * 10 * profile.penaltyWeight;

  const carbCalorieShare = (per100.macros.carbs * 4) / calories;
  const proteinCalorieShare = (per100.macros.protein * 4) / calories;
  const lowCarbBonus = (1 - carbCalorieShare) * 15 * profile.lowCarbBonusWeight;
  const proteinBonus = proteinCalorieShare * 20 * profile.proteinBonusWeight;
  const calorieEfficiencyBonus =
    (Math.max(CALORIE_EFFICIENCY_CEILING_KCAL - per100.calories, 0) / CALORIE_EFFICIENCY_CEILING_KCAL) * 10 * profile.calorieEfficiencyWeight;

  const raw = microScore - sugarPenalty - satFatPenalty - sodiumPenalty + lowCarbBonus + proteinBonus + calorieEfficiencyBonus;
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

/** carbs/100g at or above this is treated as a plant-carb staple - incompatible with carnivore's zero-carb rule regardless of name. */
const CARNIVORE_CARB_LIMIT_G = 5;
const KETO_CARB_LIMIT_G = 10;
const LOW_CARB_CARB_LIMIT_G = 20;

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
