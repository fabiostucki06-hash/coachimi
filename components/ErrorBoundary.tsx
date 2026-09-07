import { AlertTriangle } from 'lucide-react-native';
import { Component, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Unhandled render error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleRetry = () => this.setState({ error: null, componentStack: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-background-dark">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle color="#ef4444" size={24} />
        </View>
        <Text className="text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          Etwas ist schiefgelaufen
        </Text>
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
          Diese Ansicht konnte nicht geladen werden. Du kannst es erneut versuchen.
        </Text>
        <Button label="Erneut versuchen" onPress={this.handleRetry} className="mt-2" />
        <ScrollView className="max-h-64 w-full rounded-xl bg-black/90 p-3">
          <Text selectable className="text-xs font-semibold text-red-400">
            {this.state.error.toString()}
          </Text>
          <Text selectable className="mt-2 text-[10px] leading-4 text-red-200">
            {this.state.error.stack}
          </Text>
          {this.state.componentStack && (
            <Text selectable className="mt-2 text-[10px] leading-4 text-amber-300">
              {this.state.componentStack}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }
}
