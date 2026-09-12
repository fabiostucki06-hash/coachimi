import { ActivityIndicator, Image, View } from 'react-native';

/**
 * Shown for the brief window between the native splash screen hiding and the
 * app finishing store hydration / session checks (app/index.tsx). Mirrors the
 * native splash (see app.json's expo-splash-screen config) so there's no
 * visible jump - same background color and icon, just with a spinner added.
 */
export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-6" style={{ backgroundColor: '#22c55e' }}>
      <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 76, height: 76 }} resizeMode="contain" />
      <ActivityIndicator size="small" color="#ffffff" />
    </View>
  );
}
