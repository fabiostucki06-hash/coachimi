import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FoodItem } from '@/types';

interface CustomFoodState {
  customFoods: FoodItem[];
  addCustomFood: (item: Omit<FoodItem, 'id' | 'source'>) => FoodItem;
  removeCustomFood: (id: string) => void;
}

export const useCustomFoodStore = create<CustomFoodState>()(
  persist(
    (set) => ({
      customFoods: [],

      addCustomFood: (item) => {
        const foodItem: FoodItem = { ...item, id: `custom-${Date.now()}-${Math.round(Math.random() * 1e6)}`, source: 'custom' };
        set((state) => ({ customFoods: [foodItem, ...state.customFoods] }));
        return foodItem;
      },

      removeCustomFood: (id) => {
        set((state) => ({ customFoods: state.customFoods.filter((item) => item.id !== id) }));
      },
    }),
    {
      name: 'coach-imi-custom-food-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
