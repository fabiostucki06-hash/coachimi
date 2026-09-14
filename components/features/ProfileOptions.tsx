import { Pressable, Text, View } from 'react-native';

import type { ActivityLevel, Gender, Goal, MacroRatioPreset, MicronutrientFocus } from '@/utils/nutritionCalculator';

export const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: 'weight_loss', label: 'Abnehmen' },
  { id: 'maintain', label: 'Halten' },
  { id: 'muscle_gain', label: 'Muskelaufbau' },
  { id: 'endurance', label: 'Ausdauer/Leistung' },
];

export const MACRO_RATIO_OPTIONS: { id: MacroRatioPreset; label: string }[] = [
  { id: 'high_protein_low_carb', label: 'High Protein/Low Carb' },
  { id: 'balanced', label: 'Ausgewogen' },
  { id: 'keto', label: 'Keto' },
  { id: 'custom', label: 'Individuell' },
];

export const MICRONUTRIENT_FOCUS_OPTIONS: { id: MicronutrientFocus; label: string }[] = [
  { id: 'none', label: 'Kein Fokus' },
  { id: 'iron', label: 'Eisen' },
  { id: 'fiber', label: 'Ballaststoffe' },
  { id: 'vitamins', label: 'Vitamine' },
];

export const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Männlich' },
  { id: 'female', label: 'Weiblich' },
];

export const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string }[] = [
  { id: 'sedentary', label: 'Sitzend' },
  { id: 'light', label: 'Leicht aktiv' },
  { id: 'moderate', label: 'Moderat aktiv' },
  { id: 'active', label: 'Sehr aktiv' },
];

export function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            className={`rounded-full border px-4 py-2 backdrop-blur-md transition-colors duration-150 ease-in-out active:opacity-80 ${
              isSelected ? 'border-primary/60 bg-primary/10' : 'border-surface-border bg-white/5'
            }`}
          >
            <Text
              className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-text-secondary'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
