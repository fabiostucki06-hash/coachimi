import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { NUTRIENT_CATEGORY_LABELS, NUTRIENT_CATEGORY_ORDER, NUTRIENT_META, NUTRIENT_ORDER } from '@/components/features/nutrientMeta';
import type { NutrientKey, NutrientVisibility } from '@/types';

interface NutrientVisibilitySelectorProps {
  visibleNutrients: NutrientVisibility;
  onToggle: (key: NutrientKey) => void;
}

export function NutrientVisibilitySelector({ visibleNutrients, onToggle }: NutrientVisibilitySelectorProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const visibleCount = NUTRIENT_ORDER.filter((key) => visibleNutrients[key]).length;

  const groups = useMemo(() => {
    return NUTRIENT_CATEGORY_ORDER.map((category) => ({
      category,
      keys: NUTRIENT_ORDER.filter((key) => {
        if (NUTRIENT_META[key].category !== category) return false;
        if (normalizedQuery !== '') return NUTRIENT_META[key].label.toLowerCase().includes(normalizedQuery);
        return visibleNutrients[key] ?? false;
      }),
    })).filter((group) => group.keys.length > 0);
  }, [normalizedQuery, visibleNutrients]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-secondary">Sichtbare Nährstoffe</Text>
        <Text className="text-xs text-text-secondary">{visibleCount} ausgewählt</Text>
      </View>

      <View className="flex-row items-center gap-2 rounded-2xl border border-surface-border bg-overlay/5 px-4 py-2.5 transition-shadow duration-200 ease-in-out  ">
        <Search color="#A1A1AA" size={16} />
        <TextInput
          className="flex-1 text-sm text-foreground"
          placeholder="Nährstoff suchen..."
          placeholderTextColor="#A1A1AA"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Suche leeren"
            className="h-5 w-5 items-center justify-center rounded-full bg-overlay/10 transition-colors duration-150 ease-in-out active:opacity-70"
          >
            <X color="#A1A1AA" size={11} />
          </Pressable>
        )}
      </View>

      {groups.length === 0 ? (
        <Text className="py-4 text-center text-sm text-text-secondary">Kein Nährstoff gefunden.</Text>
      ) : (
        groups.map(({ category, keys }) => (
          <View key={category} className="gap-1">
            <Text className="pt-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {NUTRIENT_CATEGORY_LABELS[category]}
            </Text>
            {keys.map((key, index) => {
              const { label, Icon, color } = NUTRIENT_META[key];
              return (
                <View
                  key={key}
                  className={`flex-row items-center justify-between py-3 ${
                    index > 0 ? 'border-t border-surface-border ' : ''
                  }`}
                >
                  <View className="flex-1 flex-row items-center gap-3 pr-3">
                    <Icon color={color} size={18} />
                    <Text className="flex-1 text-sm text-foreground">{label}</Text>
                  </View>
                  <Switch
                    value={visibleNutrients[key] ?? false}
                    onValueChange={() => onToggle(key)}
                    trackColor={{ false: '#52525B', true: '#6366F1' }}
                    thumbColor="#ffffff"
                  />
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}
