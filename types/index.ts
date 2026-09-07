import type { ActivityLevel, Gender, Goal, MacroRatioPreset, MicronutrientFocus } from '@/utils/nutritionCalculator';

export interface Macros {
  carbs: number;
  protein: number;
  fat: number;
}

// All optional: real food data (the local database, the barcode/search API, and
// AI photo estimates) rarely reports every one of these, so a missing field
// means "unknown", not "zero" - aggregation treats it as 0 when summing.
export interface Micronutrients {
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
  cholesterol?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
  copper?: number;
  manganese?: number;
  selenium?: number;
  iodine?: number;
  vitaminA?: number;
  vitaminB1?: number;
  vitaminB2?: number;
  vitaminB3?: number;
  vitaminB5?: number;
  vitaminB6?: number;
  vitaminB7?: number;
  vitaminB9?: number;
  vitaminB12?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminE?: number;
  vitaminK?: number;
}

export type NutrientKey = keyof Macros | keyof Micronutrients;

export type NutrientCategory = 'macro' | 'vitamin' | 'mineral' | 'other';

export type NutrientVisibility = Record<NutrientKey, boolean>;

export interface User {
  id: string;
  name: string;
  email: string;
  dailyCalorieGoal: number;
  dailyMacroGoal: Macros;
  weightKg?: number;
  goalWeightKg?: number;
  heightCm?: number;
  age?: number;
  gender?: Gender;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  macroRatioPreset?: MacroRatioPreset;
  micronutrientFocus?: MicronutrientFocus;
  visibleNutrients: NutrientVisibility;
}

export type FoodItemSource = 'local' | 'recent' | 'off';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  caloriesPerServing: number;
  macrosPerServing: Macros;
  micronutrientsPerServing: Micronutrients;
  servingSize: number;
  servingUnit: string;
  /** Where this item came from - drives the "Standard"/"Zuletzt" badge in search results. Undefined for custom user-created items. */
  source?: FoodItemSource;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drinks';

export interface MealEntry {
  id: string;
  foodItem: FoodItem;
  mealType: MealType;
  servings: number;
  loggedAt: string;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  entries: MealEntry[];
  totalCalories: number;
  totalMacros: Macros;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}
