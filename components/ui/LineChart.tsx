import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

interface LineChartProps {
  points: number[];
  firstLabel?: string;
  lastLabel?: string;
  color?: string;
  height?: number;
}

const UNIT_PER_POINT = 50;

export function LineChart({ points, firstLabel, lastLabel, color = '#6366F1', height = 120 }: LineChartProps) {
  if (points.length === 0) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-sm text-text-secondary">Noch keine Daten</Text>
      </View>
    );
  }

  const width = Math.max(points.length - 1, 1) * UNIT_PER_POINT;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = height * 0.1;

  const coords = points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polylinePoints = coords.map(({ x, y }) => `${x},${y}`).join(' ');

  return (
    <View className="gap-2">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r={4} fill={color} />
        ))}
      </Svg>
      {(firstLabel || lastLabel) && (
        <View className="flex-row justify-between">
          <Text className="text-xs text-text-secondary">{firstLabel}</Text>
          <Text className="text-xs text-text-secondary">{lastLabel}</Text>
        </View>
      )}
    </View>
  );
}
