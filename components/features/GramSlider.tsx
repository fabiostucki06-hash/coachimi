import { useEffect, useRef } from 'react';
import { PanResponder, View } from 'react-native';

interface GramSliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

/**
 * Drag-to-scale weight slider (no external dependency - built on RN's own
 * PanResponder) for the "Instant Gram Adjuster": dragging calls `onChange` on
 * every move, so the caller's own gram state updates live and every derived
 * macro/micro total recalculates in real time, same as the +/- steppers and
 * TextField it sits alongside in app/analyze-food.tsx.
 */
export function GramSlider({ value, min = 0, max, step = 5, onChange }: GramSliderProps) {
  const trackRef = useRef<View>(null);
  const trackLayoutRef = useRef({ pageX: 0, width: 0 });
  // onChange is a fresh inline closure on every parent render (one per item card) -
  // PanResponder.create only runs once (lazy useRef init below), so its handlers must
  // read the CURRENT onChange through a ref rather than close over the first one.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  function valueFromPageX(pageX: number): number {
    const { pageX: trackX, width } = trackLayoutRef.current;
    if (width <= 0) return value;
    const ratio = (pageX - trackX) / width;
    const raw = min + Math.min(1, Math.max(0, ratio)) * (max - min);
    return Math.min(max, Math.max(min, Math.round(raw / step) * step));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => onChangeRef.current(valueFromPageX(event.nativeEvent.pageX)),
      onPanResponderMove: (event) => onChangeRef.current(valueFromPageX(event.nativeEvent.pageX)),
    }),
  ).current;

  function measureTrack() {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      trackLayoutRef.current = { pageX, width };
    });
  }

  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <View ref={trackRef} onLayout={measureTrack} className="h-8 w-full justify-center" {...panResponder.panHandlers}>
      <View className="h-1.5 w-full rounded-full bg-overlay/10">
        <View className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </View>
      <View className="absolute h-5 w-5 -ml-2.5 rounded-full bg-primary shadow-md shadow-primary/40" style={{ left: `${pct}%` }} />
    </View>
  );
}
