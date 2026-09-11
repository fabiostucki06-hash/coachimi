import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PortionUnitPicker } from '@/components/features/PortionUnitPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { updateMealAndSync } from '@/services/diaryActions';
import { useDiaryStore } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry, MealType } from '@/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

// Must be a stable reference: a fresh `[]` literal returned from the zustand
// selector on every call (when there's nothing logged for `date` yet) makes
// useSyncExternalStore see a "new" value on every render and loop forever.
const EMPTY_ENTRIES: MealEntry[] = [];

export default function EditMealEntryScreen() {
  const params = useLocalSearchParams<{ entryId: string }>();
  const date = useUiStore((state) => state.selectedDate);
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);
  const entry = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES).find(
    (candidate) => candidate.id === params.entryId,
  );

  const isGramBased = entry?.foodItem.servingUnit === 'g';
  const [amount, setAmount] = useState(() =>
    entry ? String(isGramBased ? Math.round(entry.foodItem.servingSize * entry.servings) : Math.round(entry.servings * 100) / 100) : '',
  );
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? 'breakfast');
  const [selectedPortionId, setSelectedPortionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleAmountChange(value: string) {
    setAmount(value);
    setSelectedPortionId(null);
  }

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const servings = entry ? (isGramBased ? validAmount / entry.foodItem.servingSize : validAmount) : 0;

  const computed = useMemo(() => {
    if (!entry) return { kcal: 0, carbs: 0, protein: 0, fat: 0 };
    return {
      kcal: entry.foodItem.caloriesPerServing * servings,
      carbs: entry.foodItem.macrosPerServing.carbs * servings,
      protein: entry.foodItem.macrosPerServing.protein * servings,
      fat: entry.foodItem.macrosPerServing.fat * servings,
    };
  }, [entry, servings]);

  function handleClose() {
    router.back();
  }

  async function handleSave() {
    if (!entry || servings <= 0 || saving) return;
    setSaving(true);
    try {
      await updateMealAndSync(date, entry.id, { servings, mealType });
    } catch {
      // Failure toast already shown inside updateMealAndSync; stay on screen so the user can retry.
      setSaving(false);
      return;
    }
    router.back();
  }

  if (!entry) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 dark:bg-background-dark">
        <Text className="text-sm text-slate-400">Eintrag nicht gefunden.</Text>
        <Button label="Schließen" variant="secondary" onPress={handleClose} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white" numberOfLines={1}>
            {entry.foodItem.name}
          </Text>
          <Text className="text-xs text-slate-400">Eintrag bearbeiten</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-slate-200/50 bg-slate-100/60 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
          onPress={handleClose}
        >
          <X color="#64748b" size={18} />
        </Pressable>
      </View>

      <View className="gap-6 px-6 pt-6">
        <TextField
          label={isGramBased ? 'Menge in Gramm' : `Anzahl ${entry.foodItem.servingUnit}`}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={handleAmountChange}
          suffix={isGramBased ? 'g' : entry.foodItem.servingUnit}
          autoFocus
        />

        {isGramBased && (
          <PortionUnitPicker
            foodName={entry.foodItem.name}
            selectedId={selectedPortionId}
            onSelect={(unit) => {
              setAmount(String(unit.grams));
              setSelectedPortionId(unit.id);
            }}
          />
        )}

        <View className="gap-2">
          <Text className="text-xs font-medium tracking-tight text-slate-500 dark:text-slate-400">Mahlzeit</Text>
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPE_ORDER.map((type) => {
              const active = type === mealType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setMealType(type)}
                  className={`rounded-full border px-4 py-2 transition-colors duration-150 ease-in-out active:opacity-80 ${
                    active
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-200/70 bg-white/70 dark:border-slate-800/60 dark:bg-slate-900/60'
                  }`}
                >
                  <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    {MEAL_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nährwerte</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-slate-600 dark:text-slate-300">Kalorien</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">{Math.round(computed.kcal)} kcal</Text>
          </View>
          {visibleNutrients.carbs && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-slate-600 dark:text-slate-300">Kohlenhydrate</Text>
              <Text className="text-sm text-slate-900 dark:text-white">{Math.round(computed.carbs)} g</Text>
            </View>
          )}
          {visibleNutrients.protein && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-slate-600 dark:text-slate-300">Eiweiß</Text>
              <Text className="text-sm text-slate-900 dark:text-white">{Math.round(computed.protein)} g</Text>
            </View>
          )}
          {visibleNutrients.fat && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-slate-600 dark:text-slate-300">Fett</Text>
              <Text className="text-sm text-slate-900 dark:text-white">{Math.round(computed.fat)} g</Text>
            </View>
          )}
        </Card>

        <Button label="Speichern" onPress={handleSave} disabled={servings <= 0 || saving} loading={saving} />
      </View>
    </SafeAreaView>
  );
}
