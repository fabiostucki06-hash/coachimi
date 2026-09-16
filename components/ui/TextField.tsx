import { useState, type ComponentProps } from 'react';
import { Text, TextInput, View } from 'react-native';

interface TextFieldProps extends ComponentProps<typeof TextInput> {
  label?: string;
  suffix?: string;
}

export function TextField({ label, suffix, className = '', onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="gap-1.5">
      {label && <Text className="text-xs font-medium tracking-tight text-text-secondary">{label}</Text>}
      <View
        className={`flex-row items-center gap-2 rounded-2xl border bg-overlay/5 px-5 py-3.5 transition-shadow duration-200 ease-in-out ${
          isFocused
            ? 'border-primary shadow-[0_0_0_4px_rgba(99,102,241,0.15)]'
            : 'border-surface-border shadow-none'
        }`}
      >
        <TextInput
          className={`flex-1 text-base text-foreground ${className}`}
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
