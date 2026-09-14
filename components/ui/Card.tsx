import type { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-surface-border bg-surface p-4 shadow-sm shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </View>
  );
}
