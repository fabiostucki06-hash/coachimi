import { Image, View } from 'react-native';

interface LogoProps {
  size?: 'sm' | 'lg';
  direction?: 'row' | 'column';
  className?: string;
}

const FULL_LOGO_URL =
  'https://nejndycalbepcfmmuiai.supabase.co/storage/v1/object/public/assets/Logo/Coach%20imi_Logo_Kiwi.png';

const SIZE_CONFIG = {
  sm: 'h-9',
  lg: 'h-20',
} as const;

/** Single source of truth for Coach imi's brand mark - used across the desktop sidebar, tab headers and onboarding so every navigation surface resolves to the same logo instead of each screen re-typing the mark. */
export function Logo({ size = 'sm', direction = 'row', className = '' }: LogoProps) {
  return (
    <View className={`${direction === 'row' ? 'flex-row items-center' : 'items-center'} ${className}`}>
      <Image
        source={{ uri: FULL_LOGO_URL }}
        accessibilityLabel="Coach imi"
        resizeMode="contain"
        className={`${SIZE_CONFIG[size]} aspect-square`}
      />
    </View>
  );
}
