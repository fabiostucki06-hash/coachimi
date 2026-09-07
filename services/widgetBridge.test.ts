jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncWidgetData, WIDGET_STORAGE_KEYS } from './widgetBridge';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('syncWidgetData', () => {
  it('writes every value under its documented widget storage key, rounded to whole numbers', async () => {
    await syncWidgetData({
      remainingKcal: 456.7,
      targetKcal: 2200,
      remainingProtein: 89.4,
      goldBars: 12,
      streak: 3,
    });

    expect(await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.kcalRemaining)).toBe('457');
    expect(await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.kcalTarget)).toBe('2200');
    expect(await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.proteinRemaining)).toBe('89');
    expect(await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.goldBars)).toBe('12');
    expect(await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.streak)).toBe('3');
  });

  it('matches the widget_* key names a native widget extension would look up', () => {
    expect(WIDGET_STORAGE_KEYS.kcalRemaining).toBe('widget_kcal_remaining');
    expect(WIDGET_STORAGE_KEYS.goldBars).toBe('widget_gold_bars');
    expect(WIDGET_STORAGE_KEYS.streak).toBe('widget_streak');
  });

  it('never throws, even if the underlying storage write fails', async () => {
    const failingSetter = jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('disk full'));

    await expect(
      syncWidgetData({ remainingKcal: 1, targetKcal: 1, remainingProtein: 1, goldBars: 1, streak: 1 }),
    ).resolves.toBeUndefined();

    failingSetter.mockRestore();
  });
});
