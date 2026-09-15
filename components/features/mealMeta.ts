import { Beer, Candy, Coffee, Cookie, Croissant, CupSoda, GlassWater, IceCreamCone, Moon, Pizza, Soup, Sunrise, Sunset, UtensilsCrossed } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { IconPackId, MealType } from '@/types';

interface IconProps {
  color?: string;
  size?: number;
}

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

export const MEAL_TYPE_META: Record<MealType, { label: string; Icon: ComponentType<IconProps> }> = {
  breakfast: { label: 'Frühstück', Icon: Coffee },
  lunch: { label: 'Mittagessen', Icon: UtensilsCrossed },
  dinner: { label: 'Abendessen', Icon: Moon },
  snack: { label: 'Snacks', Icon: Cookie },
  drinks: { label: 'Getränke', Icon: GlassWater },
};

/** Coin Shop "Custom Meal Icon Packs" - alternate icon sets for the dashboard's meal cards. "default" mirrors MEAL_TYPE_META's icons exactly. */
const MEAL_ICON_PACKS: Record<IconPackId, Record<MealType, ComponentType<IconProps>>> = {
  default: {
    breakfast: Coffee,
    lunch: UtensilsCrossed,
    dinner: Moon,
    snack: Cookie,
    drinks: GlassWater,
  },
  minimal_line: {
    breakfast: Sunrise,
    lunch: Soup,
    dinner: Sunset,
    snack: Candy,
    drinks: CupSoda,
  },
  retro_bites: {
    breakfast: Croissant,
    lunch: Pizza,
    dinner: Soup,
    snack: IceCreamCone,
    drinks: Beer,
  },
};

export function getMealIcon(mealType: MealType, pack: IconPackId): ComponentType<IconProps> {
  return MEAL_ICON_PACKS[pack]?.[mealType] ?? MEAL_ICON_PACKS.default[mealType];
}
