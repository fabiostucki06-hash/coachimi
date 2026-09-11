import { Pressable, ScrollView, Text } from 'react-native';

import { PORTION_UNITS } from '@/utils/portionUnits';

interface PortionUnitPickerProps {
  onSelect: (grams: number) => void;
}

/** Horizontal row of common household-portion chips ("1 großer Apfel ~200g", ...) - tapping one fills the gram amount directly, complementing manual gram entry. */
export function PortionUnitPicker({ onSelect }: PortionUnitPickerProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-1">
      {PORTION_UNITS.map((unit) => (
        <Pressable
          key={unit.id}
          className="rounded-full border border-slate-200/70 bg-white/70 px-3.5 py-2 active:opacity-70 dark:border-slate-800/60 dark:bg-slate-900/60"
          onPress={() => onSelect(unit.grams)}
        >
          <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {unit.label} <Text className="text-slate-400">~{unit.grams}g</Text>
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
