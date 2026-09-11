import { Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

interface LogoProps {
  size?: 'sm' | 'lg';
  direction?: 'row' | 'column';
  showWordmark?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { box: 'h-9 w-9 rounded-2xl', icon: 16, text: 'text-base', gap: 'gap-2.5' },
  lg: { box: 'h-20 w-20 rounded-[28px]', icon: 32, text: 'text-lg', gap: 'gap-4' },
} as const;

/** Single source of truth for Coach imi's brand mark (icon + wordmark) - used across the desktop sidebar, tab headers and onboarding so every navigation surface resolves to the same logo instead of each screen re-typing the mark. */
export function Logo({ size = 'sm', direction = 'row', showWordmark = true, className = '' }: LogoProps) {
  const config = SIZE_CONFIG[size];

  return (
    <View className={`${direction === 'row' ? 'flex-row items-center' : 'items-center'} ${config.gap} ${className}`}>
      <View className={`${config.box} items-center justify-center bg-emerald-500 shadow-md shadow-emerald-500/25`}>
        <Sparkles color="#ffffff" size={config.icon} />
      </View>
      {showWordmark && (
        <Text className={`${config.text} font-bold tracking-tight text-slate-900 dark:text-white`}>Coach imi</Text>
      )}
    </View>
  );
}
