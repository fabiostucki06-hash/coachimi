import { useMemo } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { getPortionUnitsForFood, type PortionUnit } from '@/utils/portionUnits';

interface PortionUnitPickerProps {
  foodName: string;
  selectedId?: string | null;
  onSelect: (unit: PortionUnit) => void;
}

/** Horizontal row of food-specific portion chips ("1 kleiner Apfel ~120g", ...), matched against the searched food's name - tapping one fills the gram amount directly, complementing manual gram entry. */
export function PortionUnitPicker({ foodName, selectedId, onSelect }: PortionUnitPickerProps) {
  const units = useMemo(() => getPortionUnitsForFood(foodName), [foodName]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-1">
      {units.map((unit) => {
        const active = unit.id === selectedId;
        return (
          <Pressable
            key={unit.id}
            className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
              active
                ? 'border-primary bg-primary'
                : 'border-surface-border bg-surface'
            }`}
            onPress={() => onSelect(unit)}
          >
            <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-text-secondary'}`}>
              {unit.label} <Text className={active ? 'text-white/70' : 'text-text-secondary'}>~{unit.grams}g</Text>
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
