import { Laptop2, Moon, Sun } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemeStore } from '@/store/themeStore';
import type { ColorSchemeMode } from '@/types';

const OPTIONS: { id: ColorSchemeMode; label: string; Icon: ComponentType<{ color: string; size: number }> }[] = [
  { id: 'light', label: 'Hell', Icon: Sun },
  { id: 'dark', label: 'Dunkel', Icon: Moon },
  { id: 'system', label: 'System', Icon: Laptop2 },
];

/** Light/Dark/System segmented control - persisted in store/themeStore.ts, resolved against the OS scheme by hooks/useResolvedColorScheme.ts. */
export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <View className="flex-row gap-2">
      {OPTIONS.map(({ id, label, Icon }) => {
        const isSelected = mode === id;
        return (
          <Pressable
            key={id}
            onPress={() => setMode(id)}
            accessibilityRole="button"
            accessibilityLabel={`Design: ${label}`}
            accessibilityState={{ selected: isSelected }}
            className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 active:opacity-80 ${
              isSelected ? 'border-primary/60 bg-primary/10' : 'border-surface-border bg-surface'
            }`}
          >
            <Icon color={isSelected ? '#6366F1' : '#A1A1AA'} size={16} />
            <Text className={`text-xs font-semibold ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
