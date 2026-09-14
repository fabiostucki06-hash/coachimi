import { Coffee, Cookie, GlassWater, Moon, UtensilsCrossed } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { MealType } from '@/types';

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
