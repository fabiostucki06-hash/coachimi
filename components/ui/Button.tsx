import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary shadow-md shadow-primary/20 active:bg-[#4F46E5]',
  secondary: 'border border-surface-border bg-overlay/5 backdrop-blur-md active:bg-overlay/10',
  ghost: 'bg-transparent active:bg-overlay/5',
  danger: 'bg-red-500 shadow-md shadow-red-500/20 active:bg-red-600',
};

const VARIANT_TEXT_CLASSES: Record<Variant, string> = {
  // `primary`/`danger` sit on a solid, always-dark-enough accent color, so white
  // stays correct in both Light and Dark mode. `secondary` sits on the themed
  // `overlay` tint (near-white in Light mode), so its label must follow `foreground`.
  primary: 'text-white',
  secondary: 'text-foreground',
  ghost: 'text-primary',
  danger: 'text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3.5 transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80 ${VARIANT_CLASSES[variant]} ${
        disabled || loading ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#ffffff' : '#6366F1'} />
      ) : (
        <>
          {icon}
          <Text className={`text-base font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
