import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';

const KIWI_LOGO_URL = 'https://nejndycalbepcfmmuiai.supabase.co/storage/v1/object/public/assets/Logo/Coach%20imi_Logo_Kiwi.png';
const BACKGROUND = '#090D16';
const ACCENT = '#10b981';
const LOGO_SIZE = 120;
const TIP_INTERVAL_MS = 2500;
const TIP_FADE_MS = 300;

// Short, evidence-backed tips - reusing the exact same studies/phrasing already cited
// elsewhere in the app (utils/coachTips.ts, TrainingScienceTips.tsx) rather than
// inventing new claims, so a user who's seen those doesn't hit a contradicting number here.
const TIPS = [
  'Für Muskelaufbau optimiert eine Zufuhr von 1.6–2.2g Protein/kg Körpergewicht das Ergebnis (Morton et al., 2018).',
  '10–20 Sätze pro Muskelgruppe/Woche gelten als effektiver Trainingsbereich für Muskelaufbau (Schoenfeld et al., 2021).',
  'Vitamin C verbessert die Aufnahme von pflanzlichem (non-häm) Eisen deutlich (Hallberg et al.).',
  'EFSA empfiehlt 300–350mg Magnesium/Tag für Muskelregeneration und ATP-Synthese.',
];

/** Concentric low-opacity circles behind the logo - approximates a soft radial glow without a gradient library, since this needs to render identically on native and web. */
function GlowBackdrop() {
  return (
    <View className="absolute items-center justify-center" style={{ width: 520, height: 520 }} pointerEvents="none">
      <View className="absolute rounded-full" style={{ width: 520, height: 520, backgroundColor: ACCENT, opacity: 0.04 }} />
      <View className="absolute rounded-full" style={{ width: 340, height: 340, backgroundColor: ACCENT, opacity: 0.06 }} />
      <View className="absolute rounded-full" style={{ width: 200, height: 200, backgroundColor: ACCENT, opacity: 0.1 }} />
    </View>
  );
}

/** Indeterminate loading bar - a short highlight sliding back and forth inside a track, since startup has no real progress percentage to report. */
function LoadingBar() {
  const slide = useRef(new Animated.Value(0)).current;
  const trackWidth = 160;
  const barWidth = 56;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-barWidth, trackWidth] });

  return (
    <View
      className="overflow-hidden rounded-full"
      style={{ width: trackWidth, height: 4, backgroundColor: 'rgba(255,255,255,0.12)' }}
    >
      <Animated.View
        style={{
          width: barWidth,
          height: 4,
          borderRadius: 2,
          backgroundColor: ACCENT,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

/** Cross-fades between rotating science tips every ~2.5s. */
function RotatingTip() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: TIP_FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((prev) => (prev + 1) % TIPS.length);
        Animated.timing(opacity, { toValue: 1, duration: TIP_FADE_MS, useNativeDriver: true }).start();
      });
    }, TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [opacity]);

  return (
    <Animated.Text
      style={{ opacity }}
      className="px-10 text-center text-xs leading-5 text-white/60"
      numberOfLines={3}
    >
      {TIPS[index]}
    </Animated.Text>
  );
}

/**
 * Shown for the brief window between the native splash screen hiding and the
 * app finishing store hydration / session checks (app/index.tsx). Deliberately
 * always dark (independent of the user's light/dark preference) to match the
 * native splash (see app.json's expo-splash-screen config, same background +
 * Kiwi logo) - app/index.tsx swaps straight from this to <Redirect> in one
 * render with no intermediate screen, so there's nothing else to flicker.
 */
export function LoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });

  return (
    <View className="flex-1 items-center justify-center gap-10" style={{ backgroundColor: BACKGROUND }}>
      <GlowBackdrop />

      <View className="items-center justify-center" style={{ width: LOGO_SIZE * 1.6, height: LOGO_SIZE * 1.6 }}>
        <Animated.View
          className="absolute rounded-full"
          style={{
            width: LOGO_SIZE * 1.35,
            height: LOGO_SIZE * 1.35,
            backgroundColor: ACCENT,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <Animated.Image
          source={{ uri: KIWI_LOGO_URL }}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE, transform: [{ scale: logoScale }] }}
          resizeMode="contain"
        />
      </View>

      <LoadingBar />
      <RotatingTip />
    </View>
  );
}
