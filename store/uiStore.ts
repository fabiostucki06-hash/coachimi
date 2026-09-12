import { create } from 'zustand';

import { todayKey } from '@/store/diaryStore';
import type { FoodItem, MealType } from '@/types';

interface UiState {
  pendingFoodItem: FoodItem | null;
  pendingMealType: MealType;
  // Whether the pending selection came from the barcode scanner - log-quantity uses
  // this to preselect a matching portion chip (e.g. "1 Riegel") only for scans, since a
  // manually searched-and-picked food has no reason to jump away from its 100g default.
  pendingFromScan: boolean;
  setPendingSelection: (foodItem: FoodItem, mealType: MealType, options?: { fromScan?: boolean }) => void;
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
  pendingFromScan: false,
  selectedDate: todayKey(),

  setPendingSelection: (foodItem, mealType, options) =>
    set({ pendingFoodItem: foodItem, pendingMealType: mealType, pendingFromScan: options?.fromScan ?? false }),
  clearPendingSelection: () => set({ pendingFoodItem: null, pendingFromScan: false }),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
