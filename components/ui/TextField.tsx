import { useState, type ComponentProps } from 'react';
import { Text, TextInput, View } from 'react-native';

interface TextFieldProps extends ComponentProps<typeof TextInput> {
  label?: string;
  suffix?: string;
  /** Borderless, shorter field for dense inline forms (e.g. the weight entry row). */
  compact?: boolean;
}

export function TextField({ label, suffix, compact = false, className = '', onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="gap-1.5">
      {label && <Text className="text-xs font-medium tracking-tight text-text-secondary">{label}</Text>}
      <View
        className={`flex-row items-center gap-2 border bg-overlay/5 transition-shadow duration-200 ease-in-out ${
          compact ? 'rounded-xl px-3.5 py-2.5' : 'rounded-2xl px-5 py-3.5'
        } ${
          isFocused
            ? 'border-primary shadow-[0_0_0_4px_rgba(99,102,241,0.15)]'
            : `${compact ? 'border-transparent' : 'border-surface-border'} shadow-none`
        }`}
      >
        <TextInput
          className={`flex-1 text-foreground ${compact ? 'text-[15px]' : 'text-base'} ${className}`}
          placeholderTextColor="#A1A1AA"
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {suffix && <Text className="text-sm text-text-secondary">{suffix}</Text>}
      </View>
    </View>
  );
}
