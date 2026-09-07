import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Check, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { LOCAL_FOOD_DATABASE } from '@/data/foodDatabase';
import { addMealsAndSync } from '@/services/diaryActions';
import { searchFood } from '@/services/foodApi';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { getRecentFoods } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';
import type { FoodItem, MealType } from '@/types';
import { parseMealDescription } from '@/utils/mealTextParser';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

const EXAMPLE_PLACEHOLDER = "z. B. \"200g Hähnchenbrust mit 150g Reis und 10g Olivenöl\"";

interface EditableItem {
  id: string;
  name: string;
  grams: string;
  kcalPer100g: string;
  carbsPer100g: string;
  proteinPer100g: string;
  fatPer100g: string;
  matchedSource: FoodItem['source'] | null;
  resolving: boolean;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function fromFoodItem(id: string, name: string, grams: number, food: FoodItem | null, resolving: boolean): EditableItem {
  return {
    id,
    name,
    grams: String(Math.round(grams)),
    kcalPer100g: food ? String(Math.round((food.caloriesPerServing / food.servingSize) * 100)) : '',
    carbsPer100g: food ? String(Math.round((food.macrosPerServing.carbs / food.servingSize) * 100)) : '',
    proteinPer100g: food ? String(Math.round((food.macrosPerServing.protein / food.servingSize) * 100)) : '',
    fatPer100g: food ? String(Math.round((food.macrosPerServing.fat / food.servingSize) * 100)) : '',
    matchedSource: food?.source ?? null,
    resolving,
  };
}

export default function MealParserScreen() {
  const params = useLocalSearchParams<{ mealType: MealType }>();
  const mealType = params.mealType ?? 'breakfast';
  const selectedDate = useUiStore((state) => state.selectedDate);
  const customFoods = useCustomFoodStore((state) => state.customFoods);

  const [description, setDescription] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  function handleClose() {
    router.back();
  }

  async function handleAnalyze() {
    const trimmed = description.trim();
    if (!trimmed || analyzing) return;

    setAnalyzing(true);
    setHasAnalyzed(true);

    const localPool = [...getRecentFoods(), ...customFoods, ...LOCAL_FOOD_DATABASE];
    const parsed = parseMealDescription(trimmed, localPool);

    const nextItems = parsed.map((entry, index) =>
      fromFoodItem(`item-${index}-${Date.now()}`, entry.name, entry.quantityGrams, entry.matched, entry.matched === null),
    );
    setItems(nextItems);
    setAnalyzing(false);

    // Background fallback: anything not matched locally gets looked up on Open Food Facts,
    // same "local first, then network" priority as the search screen - never blocks the UI.
    parsed.forEach((entry, index) => {
      if (entry.matched) return;
      const itemId = nextItems[index].id;
      searchFood(entry.name)
        .then((results) => {
          const best = results[0] ?? null;
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...fromFoodItem(item.id, item.name, parseNumber(item.grams, entry.quantityGrams), best, false) } : item,
            ),
          );
        })
        .catch(() => {
          setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, resolving: false } : item)));
        });
    });
  }

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const itemTotals = useMemo(
    () =>
      items.map((item) => {
        const grams = parseNumber(item.grams, 0);
        return {
          id: item.id,
          grams,
          kcal: (parseNumber(item.kcalPer100g, 0) * grams) / 100,
        };
      }),
    [items],
  );

  const grandTotalKcal = itemTotals.reduce((sum, t) => sum + t.kcal, 0);
  const validItemCount = items.filter((item) => item.name.trim() && parseNumber(item.grams, 0) > 0).length;

  async function handleSave() {
    if (validItemCount === 0 || saving) return;

    const meals = items.flatMap((item) => {
      const grams = parseNumber(item.grams, 0);
      if (!item.name.trim() || grams <= 0) return [];

      const foodItem: FoodItem = {
        id: `parsed-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        name: item.name.trim(),
        caloriesPerServing: parseNumber(item.kcalPer100g, 0),
        macrosPerServing: {
          carbs: parseNumber(item.carbsPer100g, 0),
          protein: parseNumber(item.proteinPer100g, 0),
          fat: parseNumber(item.fatPer100g, 0),
        },
        micronutrientsPerServing: { fiber: 0, sugar: 0, sodium: 0, vitaminC: 0 },
        servingSize: 100,
        servingUnit: 'g',
      };

      return [{ foodItem, mealType, servings: grams / 100 }];
    });

    setSaving(true);
    try {
      await addMealsAndSync(selectedDate, meals);
    } catch {
      setSaving(false);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Essen beschreiben</Text>
          <Text className="text-xs text-slate-400">{MEAL_LABELS[mealType]}</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-slate-200/50 bg-slate-100/60 backdrop-blur-md transition-all duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
          onPress={handleClose}
        >
          <X color="#64748b" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pt-4 pb-12">
        <View className="gap-3 rounded-[28px] border border-dashed border-slate-300/70 bg-white/40 p-5 dark:border-slate-700/70 dark:bg-white/5">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <Sparkles color="#10b981" size={16} />
            </View>
            <Text className="flex-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Beschreibe dein Essen
            </Text>
          </View>
          <TextInput
            className="min-h-[90px] rounded-2xl border border-slate-200/70 bg-[#EDF2F7] px-4 py-3 text-base text-slate-900 dark:border-slate-800/60 dark:bg-white/5 dark:text-white"
            placeholder={EXAMPLE_PLACEHOLDER}
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <Button
            label="Analysieren"
            icon={<Sparkles color="#ffffff" size={16} />}
            onPress={handleAnalyze}
            disabled={!description.trim() || analyzing}
            loading={analyzing}
          />
        </View>

        {hasAnalyzed && !analyzing && items.length === 0 && (
          <Text className="text-center text-sm text-slate-400">Keine Lebensmittel erkannt. Bitte anders formulieren.</Text>
        )}

        {items.map((item) => {
          const totals = itemTotals.find((t) => t.id === item.id);
          return (
            <Card key={item.id} className="gap-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <TextField label="Lebensmittel" value={item.name} onChangeText={(text) => updateItem(item.id, { name: text })} placeholder="Name" />
                </View>
                <Pressable
                  className="mt-6 h-8 w-8 items-center justify-center rounded-full bg-slate-100/60 active:opacity-80 dark:bg-white/5"
                  onPress={() => removeItem(item.id)}
                >
                  <X color="#64748b" size={14} />
                </Pressable>
              </View>

              {item.resolving && (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text className="text-xs text-slate-400">Wird bei Open Food Facts gesucht...</Text>
                </View>
              )}
              {!item.resolving && !item.matchedSource && (
                <View className="flex-row items-center gap-1.5 self-start rounded-full bg-amber-500/10 px-2.5 py-1">
                  <AlertTriangle color="#d97706" size={12} />
                  <Text className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Kein Treffer gefunden – bitte Nährwerte prüfen
                  </Text>
                </View>
              )}

              <TextField label="Menge" keyboardType="decimal-pad" value={item.grams} onChangeText={(text) => updateItem(item.id, { grams: text })} suffix="g" />

              <Text className="pt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Nährwerte pro 100g (bearbeitbar)</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField label="Kcal" keyboardType="decimal-pad" value={item.kcalPer100g} onChangeText={(text) => updateItem(item.id, { kcalPer100g: text })} />
                </View>
                <View className="flex-1">
                  <TextField label="Carbs" keyboardType="decimal-pad" value={item.carbsPer100g} onChangeText={(text) => updateItem(item.id, { carbsPer100g: text })} suffix="g" />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField label="Protein" keyboardType="decimal-pad" value={item.proteinPer100g} onChangeText={(text) => updateItem(item.id, { proteinPer100g: text })} suffix="g" />
                </View>
                <View className="flex-1">
                  <TextField label="Fett" keyboardType="decimal-pad" value={item.fatPer100g} onChangeText={(text) => updateItem(item.id, { fatPer100g: text })} suffix="g" />
                </View>
              </View>

              <Text className="text-right text-xs text-slate-400">
                {Math.round(totals?.kcal ?? 0)} kcal für {Math.round(totals?.grams ?? 0)}g
              </Text>
            </Card>
          );
        })}

        {items.length > 0 && (
          <Card className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Gesamt</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">{Math.round(grandTotalKcal)} kcal</Text>
          </Card>
        )}

        {items.length > 0 && (
          <Button
            label={`Ins Tagebuch speichern${validItemCount > 1 ? ` (${validItemCount} Einträge)` : ''}`}
            icon={<Check color="#ffffff" size={18} />}
            onPress={handleSave}
            disabled={validItemCount === 0 || saving}
            loading={saving}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
