import { RefreshCw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';

import { clearCachesAndReload } from '@/utils/hardRefresh';

// Reload happens a tick after the button press so the spin animation is
// actually visible before the page navigation tears down the JS context.
const RELOAD_DELAY_MS = 250;

export function HardRefreshButton({ className }: { className?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (Platform.OS !== 'web') return null;

  function handlePress() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    spin.setValue(0);
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    setTimeout(clearCachesAndReload, RELOAD_DELAY_MS);
  }

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={handlePress}
      disabled={isRefreshing}
      accessibilityRole="button"
      accessibilityLabel="App neu laden / Cache leeren"
      // @ts-expect-error react-native-web forwards unknown props to the DOM node; this renders a native browser tooltip.
      title="App neu laden / Cache leeren"
      className={`h-10 w-10 items-center justify-center rounded-full border border-slate-200/60 bg-white/70 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5 ${className ?? ''}`}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshCw color="#475569" size={18} />
      </Animated.View>
    </Pressable>
  );
}
