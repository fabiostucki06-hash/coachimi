import { useId, useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useResolvedColorScheme } from '@/hooks/useResolvedColorScheme';

export interface LineChartPoint {
  value: number;
  /** Short x-axis label (e.g. "12.10."), also shown in the tooltip. */
  label: string;
}

interface LineChartProps {
  data: LineChartPoint[];
  color?: string;
  unit?: string;
}

// Must match the `h-40` (160px) container below.
const HEIGHT = 160;
const Y_GUTTER = 34;
const TOP_PAD = 34;
const BOTTOM_PAD = 8;
const TOOLTIP_W = 76;
const TOOLTIP_H = 26;

function formatValue(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Monotone cubic (Fritsch-Carlson) path through the points - smooth like a spline,
 * but never overshoots between two samples, so a flat week doesn't render as a
 * fake dip/bump the user never weighed.
 */
function monotonePath(coords: { x: number; y: number }[]): string {
  const n = coords.length;
  if (n === 1) return `M${coords[0].x},${coords[0].y}`;

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((coords[i + 1].y - coords[i].y) / (coords[i + 1].x - coords[i].x || 1));
  }
  const tangents = coords.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  let d = `M${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (coords[i + 1].x - coords[i].x) / 3;
    d += ` C${coords[i].x + dx},${coords[i].y + tangents[i] * dx} ${coords[i + 1].x - dx},${coords[i + 1].y - tangents[i + 1] * dx} ${coords[i + 1].x},${coords[i + 1].y}`;
  }
  return d;
}

/**
 * Smooth line chart with a soft area fill, three y-axis reference lines and a
 * tap-to-inspect tooltip (defaults to the latest point). Rendered in real pixels
 * from the measured width rather than a stretched viewBox, so dots and text stay
 * round/undistorted at any container size.
 */
export function LineChart({ data, color = '#6366F1', unit = 'kg' }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const gradientId = `line-fill-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const isLight = useResolvedColorScheme() === 'light';
  const axisColor = isLight ? '#64748B' : '#A1A1AA';
  const gridColor = isLight ? '#E2E8F0' : '#334155';

  if (data.length === 0) {
    return (
      <View className="h-32 items-center justify-center rounded-2xl bg-overlay/5">
        <Text className="text-sm text-text-secondary">Noch keine Daten</Text>
      </View>
    );
  }

  const values = data.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.15, 0.5);
  const lo = Math.floor((rawMin - pad) * 2) / 2;
  const hi = Math.ceil((rawMax + pad) * 2) / 2;
  const ticks = [hi, (hi + lo) / 2, lo];

  const plotW = Math.max(width - Y_GUTTER - 8, 1);
  const plotH = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const xOf = (index: number) =>
    Y_GUTTER + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const yOf = (value: number) => TOP_PAD + (1 - (value - lo) / (hi - lo || 1)) * plotH;

  const coords = data.map((point, index) => ({ x: xOf(index), y: yOf(point.value) }));
  const linePath = monotonePath(coords);
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x},${TOP_PAD + plotH} L${coords[0].x},${TOP_PAD + plotH} Z`
      : '';

  const activeIndex = selected !== null && selected < data.length ? selected : data.length - 1;
  const active = coords[activeIndex];
  const tooltipX = Math.min(Math.max(active.x - TOOLTIP_W / 2, Y_GUTTER), width - TOOLTIP_W);

  function handlePress(event: GestureResponderEvent) {
    if (data.length === 1) return;
    const x = event.nativeEvent.locationX - Y_GUTTER;
    const index = Math.round((x / plotW) * (data.length - 1));
    setSelected(Math.min(Math.max(index, 0), data.length - 1));
  }

  const midLabel = data.length > 2 ? data[Math.floor((data.length - 1) / 2)].label : null;

  return (
    <View className="gap-1.5">
      <View className="h-40" onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {ticks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={Y_GUTTER}
                x2={width}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={gridColor}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}
            {ticks.map((tick) => (
              <SvgText key={`tick-${tick}`} x={0} y={yOf(tick) + 3.5} fontSize={10} fill={axisColor}>
                {formatValue(tick)}
              </SvgText>
            ))}

            {areaPath !== '' && <Path d={areaPath} fill={`url(#${gradientId})`} />}
            <Path d={linePath} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />

            <Line x1={active.x} x2={active.x} y1={active.y} y2={TOP_PAD + plotH} stroke={color} strokeOpacity={0.35} strokeWidth={1} />
            <Circle cx={active.x} cy={active.y} r={5.5} fill={color} stroke={isLight ? '#ffffff' : '#0F172A'} strokeWidth={2.5} />

            <Rect x={tooltipX} y={2} width={TOOLTIP_W} height={TOOLTIP_H} rx={8} fill={color} />
            <SvgText x={tooltipX + TOOLTIP_W / 2} y={19} fontSize={12} fontWeight="600" fill="#ffffff" textAnchor="middle">
              {`${formatValue(data[activeIndex].value)} ${unit}`}
            </SvgText>
          </Svg>
        )}
        <Pressable
          onPress={handlePress}
          accessibilityRole="adjustable"
          accessibilityLabel={`${data[activeIndex].label}: ${formatValue(data[activeIndex].value)} ${unit}`}
          className="absolute inset-0"
        />
      </View>

      <View className="flex-row justify-between pl-[34px]">
        <Text className="text-[11px] text-text-secondary">{data[0].label}</Text>
        {midLabel && <Text className="text-[11px] text-text-secondary">{midLabel}</Text>}
        <Text className={`text-[11px] ${activeIndex === data.length - 1 ? 'font-medium text-foreground' : 'text-text-secondary'}`}>
          {data.length > 1 ? data[data.length - 1].label : ''}
        </Text>
      </View>
      {activeIndex !== data.length - 1 && (
        <Text className="text-center text-[11px] text-text-secondary">Ausgewählt: {data[activeIndex].label}</Text>
      )}
    </View>
  );
}
