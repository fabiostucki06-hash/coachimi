import { act, create } from 'react-test-renderer';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn() },
}));

import { router } from 'expo-router';

import { useDiaryStore, todayKey } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';

import LogQuantityScreen from '@/app/log-quantity';

const mockDismissTo = router.dismissTo as jest.Mock;

const foodItem = {
  id: 'food-1',
  name: 'Testfood',
  caloriesPerServing: 200,
  macrosPerServing: { carbs: 20, protein: 10, fat: 5 },
  micronutrientsPerServing: { fiber: 0, sugar: 0, sodium: 0, vitaminC: 0 },
  servingSize: 100,
  servingUnit: 'g',
};

// Regression: confirming a portion must commit the entry directly to the
// diary (not stage it in the old cart) and hand the user straight back to
// the meal's detail screen with dismissTo, per the single-item confirm flow.
it('commits the entry to the diary and dismisses back to meal-detail on confirm', async () => {
  useUiStore.getState().setPendingSelection(foodItem, 'lunch');

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<LogQuantityScreen />);
  });
  const root = tree.root;

  // handleAdd is async (write-then-commit against Supabase, falling back to a
  // resolved-promise local write when signed out, as here) - let it settle.
  await act(async () => {
    await root.findByProps({ label: 'Bestätigen' }).props.onPress();
  });

  const entries = useDiaryStore.getState().entriesByDate[todayKey()] ?? [];
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ foodItem, mealType: 'lunch', servings: 1 });
  expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/meal-detail', params: { mealType: 'lunch' } });
  expect(useUiStore.getState().pendingFoodItem).toBeNull();
});
