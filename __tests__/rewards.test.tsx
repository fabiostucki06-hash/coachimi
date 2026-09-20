import { act, create } from 'react-test-renderer';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

// The coin balance now lives in store/coinsStore.ts (backend-driven, see
// supabase/migrations/0004_backend_coins.sql), not rewardStore - mocked here
// as a real zustand store (rather than a plain object) so the component's
// `useCoinsStore(selector)` hook usage still re-renders normally, and
// spendCoins is a controllable fake that mirrors the spend_coins RPC's
// "atomically decrement if affordable" contract without hitting Supabase.
jest.mock('@/store/coinsStore', () => {
  const { create: createStore } = require('zustand');
  return {
    useCoinsStore: createStore(() => ({
      coins: 0,
      addCoins: jest.fn(async () => true),
      spendCoins: jest.fn(async () => true),
    })),
  };
});

import RewardsScreen from '@/app/rewards';
import { useCoinsStore } from '@/store/coinsStore';
import { useRewardStore } from '@/store/rewardStore';

let mountedTree: ReturnType<typeof create> | null = null;

afterEach(() => {
  act(() => {
    mountedTree?.unmount();
  });
  mountedTree = null;
});

beforeEach(() => {
  useRewardStore.setState({
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    unlockedBorders: ['none'],
    activeBorder: 'none',
    unlockedIconPacks: ['default'],
    activeIconPack: 'default',
    unlockedBadges: [],
    unlockedPerks: [],
    transactionHistory: [],
    purchaseCelebration: null,
  });
  useCoinsStore.setState({
    coins: 0,
    spendCoins: jest.fn(async (amount: number) => {
      const current = useCoinsStore.getState().coins ?? 0;
      if (current < amount) return false;
      useCoinsStore.setState({ coins: current - amount });
      return true;
    }),
  });
});

// Regression coverage for the Coin Shop redesign's core loop: tapping a locked
// item's "[X] Coins" pill must NOT spend immediately - it opens the confirm
// modal, and only the modal's "Kaufen" button actually deducts coins, unlocks
// the item, equips it, and fires the unlock celebration.
it('requires confirmation before a Coin Shop purchase actually spends coins', async () => {
  useCoinsStore.setState({ coins: 30 });

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RewardsScreen />);
  });
  mountedTree = tree;
  const root = tree.root;

  act(() => {
    root.findByProps({ accessibilityLabel: 'Indigo Glow kaufen' }).props.onPress();
  });

  // Buying hasn't happened yet - only the confirm modal opened.
  expect(useCoinsStore.getState().coins).toBe(30);
  expect(useRewardStore.getState().unlockedBorders).not.toContain('indigo_glow');

  await act(async () => {
    await root.findByProps({ label: 'Kaufen' }).props.onPress();
  });

  const state = useRewardStore.getState();
  expect(useCoinsStore.getState().coins).toBe(0);
  expect(state.unlockedBorders).toContain('indigo_glow');
  expect(state.activeBorder).toBe('indigo_glow');
  expect(state.purchaseCelebration).toMatchObject({ itemName: 'Indigo Glow' });
});

it('re-equips an already-owned item for free without opening the confirm modal', async () => {
  useRewardStore.setState({ unlockedBorders: ['none', 'indigo_glow'], activeBorder: 'none' });

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RewardsScreen />);
  });
  mountedTree = tree;

  await act(async () => {
    await tree.root.findByProps({ accessibilityLabel: 'Indigo Glow ausrüsten' }).props.onPress();
  });

  expect(useRewardStore.getState().activeBorder).toBe('indigo_glow');
});
