import { Platform } from 'react-native';

/**
 * Fires a short reward haptic. Native uses Expo Haptics; web/PWA falls back to the
 * Vibration API, which most mobile browsers only honor from a direct user gesture -
 * fine here since coin rewards are always triggered by a tap.
 */
export async function triggerCoinHaptic(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([12, 40, 18]);
    }
    return;
  }

  const Haptics = await import('expo-haptics');
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
