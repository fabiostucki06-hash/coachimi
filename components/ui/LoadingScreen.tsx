import { ActivityIndicator, Image, View } from 'react-native';

const KIWI_LOGO_URL = 'https://nejndycalbepcfmmuiai.supabase.co/storage/v1/object/public/assets/Logo/Coach%20imi_Logo_Kiwi.png';

/**
 * Shown for the brief window between the native splash screen hiding and the
 * app finishing store hydration / session checks (app/index.tsx). Mirrors the
 * native splash (see app.json's expo-splash-screen config, same Kiwi logo) so
 * there's no visible jump - same background color and icon, just with a
 * spinner added.
 */
export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-6" style={{ backgroundColor: '#22c55e' }}>
      <Image source={{ uri: KIWI_LOGO_URL }} style={{ width: 140, height: 140 }} resizeMode="contain" />
      <ActivityIndicator size="small" color="#ffffff" />
    </View>
  );
}
