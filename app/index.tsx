import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/store/themeStore';
import { useUserStore } from '@/store/userStore';

// The custom LoadingScreen's pulse/glow and rotating tip need real time on screen to
// read as intentional rather than a flicker - hydration and the session check often
// both finish in well under 100ms, which isn't enough to see either animation.
const MIN_LOADING_MS = 1200;

type Phase = 'loading' | 'fadingOut' | 'done';

export default function Index() {
  const session = useSyncStore((state) => state.session);
  const sessionChecked = useSyncStore((state) => state.sessionChecked);
  const hasOnboarded = useUserStore((state) => state.hasOnboarded);
  const [hasHydrated, setHasHydrated] = useState(
    useUserStore.persist.hasHydrated() && useThemeStore.persist.hasHydrated(),
  );
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    if (hasHydrated) return;
    const unsubUser = useUserStore.persist.onFinishHydration(() => {
      if (useThemeStore.persist.hasHydrated()) setHasHydrated(true);
    });
    const unsubTheme = useThemeStore.persist.onFinishHydration(() => {
      if (useUserStore.persist.hasHydrated()) setHasHydrated(true);
    });
    return () => {
      unsubUser();
      unsubTheme();
    };
  }, [hasHydrated]);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  // Hands off from the native splash to this custom screen as soon as it mounts,
  // rather than waiting for `isReady` - the native splash previously stayed up for
  // this entire screen's lifetime and only lifted the instant this component swapped
  // straight to <Redirect>, so the custom pulse/glow/tip animation was rendered the
  // whole time but never actually visible to anyone.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const isReady = hasHydrated && sessionChecked && minTimeElapsed;

  useEffect(() => {
    if (isReady && phase === 'loading') setPhase('fadingOut');
  }, [isReady, phase]);

  if (phase !== 'done') {
    return <LoadingScreen fadeOut={phase === 'fadingOut'} onFadeOutComplete={() => setPhase('done')} />;
  }

  const destination = !session ? '/onboarding' : hasOnboarded ? '/(tabs)' : '/setup';
  return <Redirect href={destination} />;
}
