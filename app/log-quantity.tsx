import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PortionUnitPicker } from '@/components/features/PortionUnitPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { addMealAndSync } from '@/services/diaryActions';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealType } from '@/types';

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
  const clearPendingSelection = useUiStore((state) => state.clearPendingSelection);
  const selectedDate = useUiStore((state) => state.selectedDate);
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);

  const isGramBased = foodItem?.servingUnit === 'g';
  const [amount, setAmount] = useState(isGramBased ? String(foodItem?.servingSize ?? 100) : '1');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const servings = foodItem
    ? isGramBased
      ? validAmount / foodItem.servingSize
      : validAmount
    : 0;

  const computed = useMemo(() => {
    if (!foodItem) return { kcal: 0, carbs: 0, protein: 0, fat: 0 };
    return {
      kcal: foodItem.caloriesPerServing * servings,
      carbs: foodItem.macrosPerServing.carbs * servings,
      protein: foodItem.macrosPerServing.protein * servings,
      fat: foodItem.macrosPerServing.fat * servings,
    };
  }, [foodItem, servings]);

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
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 dark:bg-background-dark">
        <Text className="text-sm text-slate-400">Kein Lebensmittel ausgewählt.</Text>
        <Button label="Schließen" variant="secondary" onPress={handleClose} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white" numberOfLines={1}>
            {foodItem.name}
          </Text>
          <Text className="text-xs text-slate-400">{MEAL_LABELS[mealType]}</Text>
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
          label={isGramBased ? 'Menge in Gramm' : `Anzahl ${foodItem.servingUnit}`}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          suffix={isGramBased ? 'g' : foodItem.servingUnit}
          autoFocus
        />

        {isGramBased && <PortionUnitPicker onSelect={(grams) => setAmount(String(grams))} />}

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nährwerte</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-slate-600 dark:text-slate-300">Kalorien</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">
              {Math.round(computed.kcal)} kcal
            </Text>
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

        <Button label="Bestätigen" onPress={handleAdd} disabled={servings <= 0 || submitting} loading={submitting} />
      </View>
    </SafeAreaView>
  );
}
