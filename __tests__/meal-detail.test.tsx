import { act, create } from 'react-test-renderer';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ mealType: 'snack' }),
}));

import MealDetailScreen from '@/app/meal-detail';

// Regression test: a meal category with nothing logged for today used to crash
// with "Maximum update depth exceeded" because the diary selector returned a
// fresh `[]` literal on every call, which useSyncExternalStore treats as a
// changed value forever.
it('renders a meal detail screen with no entries for today without looping', () => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<MealDetailScreen />);
  });
  expect(tree).toBeDefined();
});
