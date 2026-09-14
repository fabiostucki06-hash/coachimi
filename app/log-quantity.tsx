import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NUTRIENT_META, NUTRIENT_ORDER } from '@/components/features/nutrientMeta';
import { PortionUnitPicker } from '@/components/features/PortionUnitPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { addMealAndSync } from '@/services/diaryActions';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealType, Micronutrients, NutrientKey } from '@/types';
import { scaleNutrientsByServings } from '@/utils/nutritionCalculator';
import { getDefaultPortionUnit } from '@/utils/portionUnits';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

export default function LogQuantityScreen() {
  const foodItem = useUiStore((state) => state.pendingFoodItem);
  const mealType = useUiStore((state) => state.pendingMealType);
  const fromScan = useUiStore((state) => state.pendingFromScan);
  const clearPendingSelection = useUiStore((state) => state.clearPendingSelection);
  const selectedDate = useUiStore((state) => state.selectedDate);
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);

  const isGramBased = foodItem?.servingUnit === 'g';
  // Preselects the portion chip matching this food (e.g. a scanned bar defaults to "1
  // Riegel") instead of a blanket 100g, so a single tap on "Bestätigen" is often enough.
  const defaultPortionUnit = isGramBased && foodItem && fromScan ? getDefaultPortionUnit(foodItem.name) : null;
  const [amount, setAmount] = useState(
    isGramBased ? String(defaultPortionUnit?.grams ?? foodItem?.servingSize ?? 100) : '1',
  );
  const [selectedPortionId, setSelectedPortionId] = useState<string | null>(defaultPortionUnit?.id ?? null);
  const [submitting, setSubmitting] = useState(false);

  function handleAmountChange(value: string) {
    setAmount(value);
    setSelectedPortionId(null);
  }

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const servings = foodItem
    ? isGramBased
      ? validAmount / foodItem.servingSize
      : validAmount
    : 0;

  // Single scaling engine for both macros and micronutrients, so a portion-shortcut
  // tap or a typed gram amount recomputes the entire nutrient preview at once instead
  // of macros and micros drifting through two separate calculations.
  const scaled = useMemo(() => {
    if (!foodItem) return null;
    return scaleNutrientsByServings(foodItem, servings);
  }, [foodItem, servings]);

  const isMicronutrientKey = (key: NutrientKey): key is keyof Micronutrients =>
    key !== 'carbs' && key !== 'protein' && key !== 'fat';

  const visibleMicronutrientKeys = useMemo(
    () => NUTRIENT_ORDER.filter((key): key is keyof Micronutrients => isMicronutrientKey(key) && visibleNutrients[key]),
    [visibleNutrients],
  );

  function handleClose() {
    clearPendingSelection();
    router.back();
  }

  async function handleAdd() {
    if (!foodItem || servings <= 0 || submitting) return;
    setSubmitting(true);
    try {
      await addMealAndSync(selectedDate, foodItem, mealType, servings);
    } catch {
      // Failure alert already shown by addMealAndSync; stay on screen so the
      // user can retry instead of silently losing the entry.
      setSubmitting(false);
      return;
    }
    clearPendingSelection();
    // Dismisses the search/scanner screens above it and lands on the meal's
    // detail view (or replaces the current screen with it if it isn't
    // already on the stack), so totals are visible immediately.
    router.dismissTo({ pathname: '/meal-detail', params: { mealType } });
  }

  if (!foodItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-text-secondary">Kein Lebensmittel ausgewählt.</Text>
        <Button label="Schließen" variant="secondary" onPress={handleClose} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold tracking-tight text-white" numberOfLines={1}>
            {foodItem.name}
          </Text>
          <Text className="text-xs text-text-secondary">{MEAL_LABELS[mealType]}</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-white/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
          onPress={handleClose}
        >
          <X color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      <View className="gap-6 px-6 pt-6">
        <TextField
          label={isGramBased ? 'Menge in Gramm' : `Anzahl ${foodItem.servingUnit}`}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={handleAmountChange}
          suffix={isGramBased ? 'g' : foodItem.servingUnit}
          autoFocus
        />

        {isGramBased && (
          <PortionUnitPicker
            foodName={foodItem.name}
            selectedId={selectedPortionId}
            onSelect={(unit) => {
              setAmount(String(unit.grams));
              setSelectedPortionId(unit.id);
            }}
          />
        )}

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-text-secondary">Nährwerte</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text-secondary">Kalorien</Text>
            <Text className="text-base font-bold text-white">
              {(scaled?.calories ?? 0).toFixed(1)} kcal
            </Text>
          </View>
          {visibleNutrients.carbs && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-text-secondary">Kohlenhydrate</Text>
              <Text className="text-sm text-white">{(scaled?.macros.carbs ?? 0).toFixed(1)} g</Text>
            </View>
          )}
          {visibleNutrients.protein && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-text-secondary">Eiweiß</Text>
              <Text className="text-sm text-white">{(scaled?.macros.protein ?? 0).toFixed(1)} g</Text>
            </View>
          )}
          {visibleNutrients.fat && (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-text-secondary">Fett</Text>
              <Text className="text-sm text-white">{(scaled?.macros.fat ?? 0).toFixed(1)} g</Text>
            </View>
          )}
          {visibleMicronutrientKeys.length > 0 && scaled && (
            <View className="gap-3 border-t border-surface-border pt-3 ">
              {visibleMicronutrientKeys.map((key) => {
                const meta = NUTRIENT_META[key];
                return (
                  <View key={key} className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">{meta.label}</Text>
                    <Text className="text-sm text-white">
                      {scaled.micronutrients[key].toFixed(1)} {meta.unit}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Button label="Bestätigen" onPress={handleAdd} disabled={servings <= 0 || submitting} loading={submitting} />
      </View>
    </SafeAreaView>
  );
}
