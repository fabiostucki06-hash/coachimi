import '@/global.css';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GoldBarCelebration } from '@/components/ui/GoldBarCelebration';
import { Toast } from '@/components/ui/Toast';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useThemeSync } from '@/hooks/useThemeSync';
import { useWidgetDeepLinks } from '@/hooks/useWidgetDeepLinks';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useSyncStore } from '@/store/syncStore';

export default function RootLayout() {
  const init = useSyncStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  useAutoUpdate();
  useThemeSync();
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
    <View className="m-0 flex-1 items-center bg-slate-100 p-0 dark:bg-slate-950 lg:items-stretch">
      <View className="w-full max-w-[480px] flex-1 lg:max-w-none">{stack}</View>
    </View>
  );
}
