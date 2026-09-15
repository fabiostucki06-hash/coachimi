import {
  Banana,
  Bone,
  Candy,
  Carrot,
  Citrus,
  Coins,
  Droplet,
  Droplets,
  Dumbbell,
  Egg,
  Fish,
  FlaskConical,
  Gem,
  Grape,
  Heart,
  Leaf,
  Nut,
  Pill,
  Salad,
  Shield,
  Sun,
  TestTube,
  Waves,
  Wheat,
  Zap,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { MealEntry, Micronutrients, NutrientCategory, NutrientKey } from '@/types';
import { scaleNutrientsByServings } from '@/utils/nutritionCalculator';

interface IconProps {
  color?: string;
  size?: number;
}

export interface NutrientMeta {
  label: string;
  unit: string;
  color: string;
  category: NutrientCategory;
  Icon: ComponentType<IconProps>;
}

export const NUTRIENT_CATEGORY_LABELS: Record<NutrientCategory, string> = {
  macro: 'Makros',
  vitamin: 'Vitamine',
  mineral: 'Mineralstoffe',
  other: 'Sonstiges',
};

export const NUTRIENT_CATEGORY_ORDER: NutrientCategory[] = ['macro', 'other', 'vitamin', 'mineral'];

export const NUTRIENT_META: Record<NutrientKey, NutrientMeta> = {
  carbs: { label: 'Carbs', unit: 'g', color: '#3b82f6', category: 'macro', Icon: Wheat },
  protein: { label: 'Protein', unit: 'g', color: '#ef4444', category: 'macro', Icon: Egg },
  fat: { label: 'Fett', unit: 'g', color: '#f59e0b', category: 'macro', Icon: Droplet },

  fiber: { label: 'Ballaststoffe', unit: 'g', color: '#84cc16', category: 'other', Icon: Leaf },
  sugar: { label: 'Zucker', unit: 'g', color: '#ec4899', category: 'other', Icon: Candy },
  /** Component of `sugar`, not additional to it - see types/index.ts's Micronutrients.fructose. */
  fructose: { label: 'Fruchtzucker', unit: 'g', color: '#db2777', category: 'other', Icon: Grape },
  saturatedFat: { label: 'Gesättigte Fettsäuren', unit: 'g', color: '#d97706', category: 'other', Icon: Droplets },
  unsaturatedFat: { label: 'Ungesättigte Fettsäuren', unit: 'g', color: '#0ea5e9', category: 'other', Icon: Fish },
  cholesterol: { label: 'Cholesterin', unit: 'mg', color: '#e11d48', category: 'other', Icon: Heart },

  vitaminA: { label: 'Vitamin A', unit: 'µg', color: '#f97316', category: 'vitamin', Icon: Carrot },
  vitaminB1: { label: 'Vitamin B1 (Thiamin)', unit: 'mg', color: '#f43f5e', category: 'vitamin', Icon: Pill },
  vitaminB2: { label: 'Vitamin B2 (Riboflavin)', unit: 'mg', color: '#fb7185', category: 'vitamin', Icon: Pill },
  vitaminB3: { label: 'Vitamin B3 (Niacin)', unit: 'mg', color: '#fbbf24', category: 'vitamin', Icon: Pill },
  vitaminB5: { label: 'Vitamin B5 (Pantothensäure)', unit: 'mg', color: '#a3e635', category: 'vitamin', Icon: Pill },
  vitaminB6: { label: 'Vitamin B6', unit: 'mg', color: '#34d399', category: 'vitamin', Icon: Pill },
  vitaminB7: { label: 'Vitamin B7 (Biotin)', unit: 'µg', color: '#22d3ee', category: 'vitamin', Icon: Pill },
  vitaminB9: { label: 'Vitamin B9 (Folsäure)', unit: 'µg', color: '#818cf8', category: 'vitamin', Icon: Pill },
  vitaminB12: { label: 'Vitamin B12', unit: 'µg', color: '#c084fc', category: 'vitamin', Icon: Pill },
  vitaminC: { label: 'Vitamin C', unit: 'mg', color: '#f97316', category: 'vitamin', Icon: Citrus },
  vitaminD: { label: 'Vitamin D', unit: 'µg', color: '#fbbf24', category: 'vitamin', Icon: Sun },
  vitaminE: { label: 'Vitamin E', unit: 'mg', color: '#ca8a04', category: 'vitamin', Icon: Nut },
  vitaminK: { label: 'Vitamin K', unit: 'µg', color: '#16a34a', category: 'vitamin', Icon: Salad },

  sodium: { label: 'Natrium', unit: 'mg', color: '#64748b', category: 'mineral', Icon: Waves },
  potassium: { label: 'Kalium', unit: 'mg', color: '#eab308', category: 'mineral', Icon: Banana },
  calcium: { label: 'Calcium', unit: 'mg', color: '#a8a29e', category: 'mineral', Icon: Bone },
  iron: { label: 'Eisen', unit: 'mg', color: '#78716c', category: 'mineral', Icon: Dumbbell },
  magnesium: { label: 'Magnesium', unit: 'mg', color: '#8b5cf6', category: 'mineral', Icon: Zap },
  zinc: { label: 'Zink', unit: 'mg', color: '#6b7280', category: 'mineral', Icon: Shield },
  copper: { label: 'Kupfer', unit: 'mg', color: '#b45309', category: 'mineral', Icon: Coins },
  manganese: { label: 'Mangan', unit: 'mg', color: '#7c3aed', category: 'mineral', Icon: FlaskConical },
  selenium: { label: 'Selen', unit: 'µg', color: '#0d9488', category: 'mineral', Icon: TestTube },
  iodine: { label: 'Jod', unit: 'µg', color: '#06b6d4', category: 'mineral', Icon: Gem },
};

export const NUTRIENT_ORDER: NutrientKey[] = [
  'carbs',
  'protein',
  'fat',
  'fiber',
  'sugar',
  'fructose',
  'saturatedFat',
  'unsaturatedFat',
  'cholesterol',
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
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'magnesium',
  'zinc',
  'copper',
  'manganese',
  'selenium',
  'iodine',
];

/** Sums every tracked nutrient (macros + optional micronutrients, treating a missing value as 0) across a set of diary entries, scaled by each entry's servings via the shared scaling engine. */
export function sumEntryNutrients(entries: MealEntry[]): Record<NutrientKey, number> {
  const totals = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, 0])) as Record<NutrientKey, number>;
  for (const entry of entries) {
    const scaled = scaleNutrientsByServings(entry.foodItem, entry.servings);
    totals.carbs += scaled.macros.carbs;
    totals.protein += scaled.macros.protein;
    totals.fat += scaled.macros.fat;
    for (const key of NUTRIENT_ORDER) {
      if (key === 'carbs' || key === 'protein' || key === 'fat') continue;
      totals[key] += scaled.micronutrients[key as keyof Micronutrients];
    }
  }
  return totals;
}
