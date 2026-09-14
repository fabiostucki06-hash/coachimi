import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GoldBarCelebration } from '@/components/ui/GoldBarCelebration';
import { Toast } from '@/components/ui/Toast';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useWidgetDeepLinks } from '@/hooks/useWidgetDeepLinks';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useSyncStore } from '@/store/syncStore';

// Per expo-splash-screen's docs, call this in global scope (not inside the component) so
// it can't run after the splash has already auto-hidden. app/index.tsx calls hideAsync()
// as soon as it mounts, handing off to its own custom LoadingScreen rather than leaving
// the native splash up until routing is actually ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const init = useSyncStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  useAutoUpdate();
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
        </Stack>
        <Toast />
        <GoldBarCelebration />
      </View>
    </ErrorBoundary>
  );

  if (Platform.OS !== 'web') return stack;

  // Below the `lg` breakpoint (tablets and phones), keep the narrow
  // phone-frame look, centered with side margins. At `lg` (1024px) and
  // above, drop the cap entirely so the sidebar sits flush against the
  // real left edge of the window instead of floating inside a centered box.
  return (
    <View className="m-0 flex-1 items-center bg-background p-0 lg:items-stretch">
      <View className="w-full max-w-[480px] flex-1 lg:max-w-none">{stack}</View>
    </View>
  );
}
