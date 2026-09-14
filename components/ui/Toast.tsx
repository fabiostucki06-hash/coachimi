import { AlertCircle, Check, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text } from 'react-native';

import { useToastStore } from '@/store/toastStore';

export function Toast() {
  const toast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: toast ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [toast, opacity]);

  if (!toast) return null;

  const isError = toast.variant === 'error';

  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-24 items-center px-6 lg:bottom-8"
      style={{ opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
    >
      <Pressable
        onPress={dismiss}
        className={`w-full max-w-md flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-xl backdrop-blur-xl active:opacity-90 ${
          isError
            ? 'border-red-500/30 bg-red-950/90 shadow-red-900/10'
            : 'border-emerald-500/30 bg-emerald-950/90 shadow-emerald-900/10'
        }`}
      >
        {isError ? <AlertCircle color="#ef4444" size={18} /> : <Check color="#10b981" size={18} />}
        <Text className={`flex-1 text-sm font-medium ${isError ? 'text-red-300' : 'text-emerald-300'}`}>
          {toast.message}
        </Text>
        <X color={isError ? '#f87171' : '#34d399'} size={14} />
      </Pressable>
    </Animated.View>
  );
}
