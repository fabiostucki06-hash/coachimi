import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

const KIWI_LOGO_URL = 'https://nejndycalbepcfmmuiai.supabase.co/storage/v1/object/public/assets/Logo/Coach%20imi_Logo_Kiwi.png';
const BACKGROUND = '#090D16';
const TRACK_COLOR = '#1F2937';
const ACCENT = '#10B981';
const LOGO_SIZE = 140;
const BAR_WIDTH = 200;
const BAR_HEIGHT = 6;
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

/** Indeterminate loading bar - a fixed-width fill pulsing in opacity inside a track, since startup has no real progress percentage to report. */
function LoadingBar() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const fillOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View
      style={{
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        backgroundColor: TRACK_COLOR,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: ACCENT,
          opacity: fillOpacity,
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
      style={{
        opacity,
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        fontStyle: 'italic',
      }}
      numberOfLines={3}
    >
      {TIPS[index]}
    </Animated.Text>
  );
}

interface LoadingScreenProps {
  /** True once app/index.tsx is ready to hand off to the real destination - plays a
   * brief opacity fade-out and calls onFadeOutComplete when it finishes, instead of
   * getting yanked off-screen by an abrupt unmount. */
  fadeOut?: boolean;
  onFadeOutComplete?: () => void;
}

/**
 * Shown from the moment the native splash screen hides until the app finishes
 * store hydration / session checks (app/index.tsx). Deliberately always dark
 * (independent of the user's light/dark preference) to match the native splash
 * (see app.json's expo-splash-screen config, same background + Kiwi logo).
 */
export function LoadingScreen({ fadeOut = false, onFadeOutComplete }: LoadingScreenProps) {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fadeOut) return;
    Animated.timing(screenOpacity, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) onFadeOutComplete?.();
      },
    );
  }, [fadeOut, screenOpacity, onFadeOutComplete]);

  return (
    <Animated.View
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: BACKGROUND,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        opacity: screenOpacity,
      }}
    >
      <View style={{ alignItems: 'center', gap: 32 }}>
        <Image
          source={{ uri: KIWI_LOGO_URL }}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="contain"
        />

        <LoadingBar />

        <RotatingTip />
      </View>
    </Animated.View>
  );
}
