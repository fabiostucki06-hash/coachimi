import { Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable } from 'react-native';

import { useThemeStore } from '@/store/themeStore';

export function ThemeToggle({ className }: { className?: string }) {
  const { colorScheme } = useColorScheme();
  const setThemePreference = useThemeStore((state) => state.setThemePreference);
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
      className={`h-10 w-10 items-center justify-center rounded-full border border-slate-200/60 bg-white/70 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5 ${className ?? ''}`}
    >
      {isDark ? <Sun color="#f59e0b" size={18} /> : <Moon color="#475569" size={18} />}
    </Pressable>
  );
}
