import '@/global.css';

import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { GoldBarCelebration } from '@/components/ui/GoldBarCelebration';
import { PurchaseCelebration } from '@/components/ui/PurchaseCelebration';
import { Toast } from '@/components/ui/Toast';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useResolvedColorScheme } from '@/hooks/useResolvedColorScheme';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useWidgetDeepLinks } from '@/hooks/useWidgetDeepLinks';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { startAutoBackup } from '@/services/localBackup';
import { startSyncManager } from '@/services/syncManager';
import { WORKOUT_IMPORT_PATH } from '@/services/workoutShare';
import { useRewardStore } from '@/store/rewardStore';
import { useSyncStore } from '@/store/syncStore';
import { getThemeVars } from '@/utils/themePalettes';

// Per expo-splash-screen's docs, call this in global scope (not inside the component) so
// it can't run after the splash has already auto-hidden. app/index.tsx calls hideAsync()
// as soon as it mounts, handing off to its own custom LoadingScreen rather than leaving
// the native splash up until routing is actually ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const init = useSyncStore((state) => state.init);
  const activeTheme = useRewardStore((state) => state.activeTheme);
  const resolvedColorScheme = useResolvedColorScheme();
  const themeVars = getThemeVars(activeTheme, resolvedColorScheme);

  useEffect(() => {
    init();
    startSyncManager();
    startAutoBackup();
  }, [init]);

  // RootLayout only mounts once per real page load (a fresh open, or the user
  // hitting reload) - client-side navigation between tabs/screens never remounts
  // it. So this fires exactly on "the PWA was just opened/reloaded", never on an
  // in-app Link/router.push, which is what lets it force every fresh load back to
  // the dashboard route without also cancelling normal in-app navigation to other
  // tabs or modals. /widget is exempt: it's a manifest.json `shortcuts` target
  // meant to be opened directly (and to stay put once opened, not bounce to '/').
  // /workout/import is exempt too: a shared-plan link carries its plan in the query.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const { pathname } = window.location;
    if (pathname !== '/' && pathname !== '/widget' && pathname !== WORKOUT_IMPORT_PATH) {
      router.replace('/');
    }
  }, []);

  useAutoUpdate();
  useServiceWorker();
  useWidgetSync();
  useWidgetDeepLinks();

  const stack = (
    <ErrorBoundary>
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="barcode-scanner" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-quantity" options={{ presentation: 'modal' }} />
          <Stack.Screen name="analyze-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="meal-detail" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-meal-entry" options={{ presentation: 'modal' }} />
          <Stack.Screen name="rewards" options={{ presentation: 'modal' }} />
          <Stack.Screen name="workout/import" options={{ presentation: 'modal' }} />
          <Stack.Screen name="widget" options={{ animation: 'fade' }} />
        </Stack>
        <Toast />
        <GoldBarCelebration />
        <PurchaseCelebration />
        <OfflineBanner />
      </View>
    </ErrorBoundary>
  );

  // The Coin Shop's active theme (utils/themePalettes.ts) is applied here as CSS
  // vars, at the outermost wrapper on both branches, so every screen's Tailwind
  // color classes (bg-background, bg-surface, bg-primary, ...) pick it up.
  if (Platform.OS !== 'web') return <View style={themeVars} className="flex-1">{stack}</View>;

  // Below the `lg` breakpoint (tablets and phones), keep the narrow
  // phone-frame look, centered with side margins. At `lg` (1024px) and
  // above, drop the cap entirely so the sidebar sits flush against the
  // real left edge of the window instead of floating inside a centered box.
  return (
    <View style={themeVars} className="m-0 flex-1 items-center overflow-hidden bg-background p-0 lg:items-stretch">
      <View className="w-full max-w-[480px] flex-1 overflow-hidden lg:max-w-none">{stack}</View>
    </View>
  );
}
