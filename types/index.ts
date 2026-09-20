import type { ActivityLevel, DietType, Gender, Goal, MacroRatioPreset, MicronutrientFocus } from '@/utils/nutritionCalculator';

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
  /** Component of `sugar` (not additional to it) - how much of the total sugar is specifically fructose, from fruit/HFCS/honey. See utils/nutritionCalculator.ts's foldFructoseIntoSugar for how a raw API's separate sugar+fructose fields resolve into `sugar`; this field is what keeps fructose visible instead of being dropped after that fold. */
  fructose?: number;
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
  dietType?: DietType;
  /** Public Supabase Storage URL for the user's uploaded profile photo (see services/profile.ts) - undefined falls back to the initials avatar (see components/features/UserAvatar.tsx). */
  avatarUrl?: string;
  visibleNutrients: NutrientVisibility;
  /** Per-nutrient daily target overrides for fiber/sugar/vitamins/minerals - unset keys fall back to the diet-computed default (see services/dietEngine.ts's getMicronutrientGoalsForDiet). Never covers carbs/protein/fat, which already have their own dailyMacroGoal. */
  micronutrientGoalOverrides?: Partial<Micronutrients>;
}

export type FoodItemSource = 'local' | 'recent' | 'off' | 'custom' | 'ai' | 'community' | 'usda' | 'fatsecret';

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

// --- Diet Cycles ---

/** 'strict' = a focused diet phase (e.g. Keto), 'cheat'/'maintenance' = a break where daily targets are typically suppressed, 'custom' = anything else. Drives both the calendar's range color (see services/cycleEngine.ts's CYCLE_TYPE_META) and the default targetDisabled suggestion in the cycle form. */
export type DietCycleType = 'strict' | 'cheat' | 'maintenance' | 'custom';

export interface DietCycle {
  /** Client-generated UUID (see store/cycleStore.ts's makeCycleId) - stays identical between the local cache and the `diet_cycles` Supabase row so a cycle created offline never has to be re-keyed once it syncs. */
  id: string;
  name: string;
  type: DietCycleType;
  /** Date key (YYYY-MM-DD), inclusive. */
  startDate: string;
  /** Date key (YYYY-MM-DD), inclusive. */
  endDate: string;
  /** true suppresses daily target goals/warnings for every date inside this cycle (e.g. a Cheat/Refeed period) - see services/cycleEngine.ts's getEffectiveDailyTargets. */
  targetDisabled: boolean;
  /** Partial macro overrides (e.g. { carbs: 30 } for a Keto phase) merged over the user's normal dailyMacroGoal - null/undefined means "use the normal goal". Ignored when targetDisabled is true. */
  targetOverrides?: Partial<Macros> | null;
}

// --- Training ---

/** One exercise slot inside a reusable workout template - a rep RANGE (not a fixed count) is the point of double progression: stay in range while adding reps, then jump weight once every set hits the top. */
export interface TemplateExercise {
  id: string;
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

export interface LoggedSet {
  weightKg: number;
  reps: number;
}

export interface LoggedExercise {
  id: string;
  name: string;
  targetRepsMin: number;
  targetRepsMax: number;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  date: string;
  exercises: LoggedExercise[];
}

// --- Rewards ---

export type BadgeId = 'gold_standard_tracker' | 'eisen_disziplin' | 'streak_meister' | 'protein_profi';

export interface RewardTransaction {
  id: string;
  amount: number;
  reason: string;
  /** Local date key (YYYY-MM-DD) the transaction happened on - drives the daily-dedup checks. */
  date: string;
  timestamp: string;
}

export interface ShopItem {
  id: BadgeId;
  name: string;
  description: string;
  cost: number;
}

export type RankId = 'neuling' | 'gold_standard_athlet' | 'eisen_disziplin_rang' | 'disziplin_legende';

export interface Rank {
  id: RankId;
  name: string;
  /** Goldbarren-Kosten - 0 für den kostenlosen Standardrang. */
  cost: number;
}

export type ThemeId = 'classic' | 'pure_black' | 'deep_indigo' | 'cyberpunk_neon';

/** Light/Dark/System - independent of the Coin Shop's cosmetic `ThemeId` skins above, which only ever vary the *dark* palette's tone. */
export type ColorSchemeMode = 'light' | 'dark' | 'system';

export interface ThemeItem {
  id: ThemeId;
  name: string;
  description: string;
  /** Goldbarren-Kosten - 0 für das kostenlose Standard-Theme. */
  cost: number;
}

export type IconPackId = 'default' | 'minimal_line' | 'retro_bites';

export interface IconPackItem {
  id: IconPackId;
  name: string;
  description: string;
  /** Goldbarren-Kosten - 0 für das kostenlose Standard-Pack. */
  cost: number;
}

export type BorderId =
  | 'none'
  | 'indigo_glow'
  | 'gold_frame'
  | 'oled_gold_glow'
  | 'cyber_neon_border'
  | 'minimal_white_ring'
  | 'swiss_red_accent';

export interface BorderItem {
  id: BorderId;
  name: string;
  description: string;
  /** Goldbarren-Kosten - 0 für "Kein Rahmen". */
  cost: number;
}

export type PerkId = 'macro_recipes_pdf';

export interface PerkItem {
  id: PerkId;
  name: string;
  description: string;
  cost: number;
}
