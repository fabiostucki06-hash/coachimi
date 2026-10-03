import { create } from 'zustand';

import { todayKey } from '@/store/diaryStore';
import type { FoodItem, MealType } from '@/types';

interface UiState {
  pendingFoodItem: FoodItem | null;
  pendingMealType: MealType;
  setPendingSelection: (foodItem: FoodItem, mealType: MealType) => void;
  clearPendingSelection: () => void;
  // The day currently shown in the diary (Tagebuch) view, picked via
  // DateSelector. Global rather than per-screen state so meal-detail,
  // add-food's log-quantity step, etc. all log/read entries against the
  // same day the user is actually looking at, not always "today".
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  pendingFoodItem: null,
  pendingMealType: 'breakfast',
  selectedDate: todayKey(),

  setPendingSelection: (foodItem, mealType) => set({ pendingFoodItem: foodItem, pendingMealType: mealType }),
  clearPendingSelection: () => set({ pendingFoodItem: null }),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
