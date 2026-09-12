import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useSyncStore } from '@/store/syncStore';
import { useUserStore } from '@/store/userStore';

export default function Index() {
  const session = useSyncStore((state) => state.session);
  const sessionChecked = useSyncStore((state) => state.sessionChecked);
  const hasOnboarded = useUserStore((state) => state.hasOnboarded);
  const [hasHydrated, setHasHydrated] = useState(useUserStore.persist.hasHydrated());

  useEffect(() => {
    if (hasHydrated) return;
    return useUserStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, [hasHydrated]);

  const isReady = hasHydrated && sessionChecked;

  useEffect(() => {
    // Keeps the native splash up (see app/_layout.tsx's preventAutoHideAsync) until we
    // actually know where to route - hiding it earlier would flash the blank root view
    // for the same window LoadingScreen below covers on web.
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return <LoadingScreen />;

  const destination = !session ? '/onboarding' : hasOnboarded ? '/(tabs)' : '/setup';
  return <Redirect href={destination} />;
}
