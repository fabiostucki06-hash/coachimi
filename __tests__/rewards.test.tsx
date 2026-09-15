import { act, create } from 'react-test-renderer';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

import RewardsScreen from '@/app/rewards';
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
    goldBars: 0,
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
});

// Regression coverage for the Coin Shop redesign's core loop: tapping a locked
// item's "[X] Coins" pill must NOT spend immediately - it opens the confirm
// modal, and only the modal's "Kaufen" button actually deducts coins, unlocks
// the item, equips it, and fires the unlock celebration.
it('requires confirmation before a Coin Shop purchase actually spends coins', () => {
  useRewardStore.setState({ goldBars: 30 });

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
  expect(useRewardStore.getState().goldBars).toBe(30);
  expect(useRewardStore.getState().unlockedBorders).not.toContain('indigo_glow');

  act(() => {
    root.findByProps({ label: 'Kaufen' }).props.onPress();
  });

  const state = useRewardStore.getState();
  expect(state.goldBars).toBe(0);
  expect(state.unlockedBorders).toContain('indigo_glow');
  expect(state.activeBorder).toBe('indigo_glow');
  expect(state.purchaseCelebration).toMatchObject({ itemName: 'Indigo Glow' });
});

it('re-equips an already-owned item for free without opening the confirm modal', () => {
  useRewardStore.setState({ goldBars: 0, unlockedBorders: ['none', 'indigo_glow'], activeBorder: 'none' });

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RewardsScreen />);
  });
  mountedTree = tree;

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Indigo Glow ausrüsten' }).props.onPress();
  });

  expect(useRewardStore.getState().activeBorder).toBe('indigo_glow');
});
