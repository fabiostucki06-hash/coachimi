import AsyncStorage from '@react-native-async-storage/async-storage';

// This app is Expo-managed (no Capacitor, no ios/android native folders), so
// there is no `@capacitor/preferences` bridge to a native App
// Group/SharedPreferences store to write into here. AsyncStorage is this
// app's actual shared key-value store, so that's what this mirrors widget
// data into. A real home-screen widget (a Swift WidgetKit extension on iOS,
// a Kotlin Glance/AppWidgetProvider on Android) still needs its own native
// project + a config plugin wiring an App Group/SharedPreferences file to
// this same storage - that native half isn't something this file can
// provide, but the key names below are stable so that plugin can target them.
export const WIDGET_STORAGE_KEYS = {
  kcalRemaining: 'widget_kcal_remaining',
  kcalTarget: 'widget_kcal_target',
  proteinRemaining: 'widget_protein_remaining',
  goldBars: 'widget_gold_bars',
  streak: 'widget_streak',
} as const;

export interface WidgetData {
  remainingKcal: number;
  targetKcal: number;
  remainingProtein: number;
  goldBars: number;
  streak: number;
}

/** Mirrors the values a home-screen widget needs into shared storage. Safe to call often - failures are logged, never thrown, so a widget-sync hiccup can't break the app. */
export async function syncWidgetData(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [WIDGET_STORAGE_KEYS.kcalRemaining, String(Math.round(data.remainingKcal))],
      [WIDGET_STORAGE_KEYS.kcalTarget, String(Math.round(data.targetKcal))],
      [WIDGET_STORAGE_KEYS.proteinRemaining, String(Math.round(data.remainingProtein))],
      [WIDGET_STORAGE_KEYS.goldBars, String(Math.round(data.goldBars))],
      [WIDGET_STORAGE_KEYS.streak, String(Math.round(data.streak))],
    ]);
  } catch (error) {
    console.error('[widgetBridge] Failed to sync widget data:', error);
  }
}
