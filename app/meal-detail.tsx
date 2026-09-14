import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Copy, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NUTRIENT_META, NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { copyEntryAndSync, copyMealAndSync, removeMealAndSync } from '@/services/diaryActions';
import { useDiaryStore } from '@/store/diaryStore';
import { useToastStore } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry, MealType, NutrientKey } from '@/types';
import { formatDateShort } from '@/utils/calendarDates';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

// Must be a stable reference: a fresh `[]` literal returned from the zustand
// selector on every call (when there's nothing logged for `date` yet) makes
// useSyncExternalStore see a "new" value on every render and loop forever.
const EMPTY_ENTRIES: MealEntry[] = [];

function formatAmount(entry: MealEntry): string {
  const { foodItem, servings } = entry;
  if (foodItem.servingUnit === 'g') {
    return `${Math.round(foodItem.servingSize * servings)} g`;
  }
  const count = Math.round(servings * 100) / 100;
  return `${count} ${foodItem.servingUnit}`;
}

function NutrientStat({ nutrientKey, value }: { nutrientKey: NutrientKey; value: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  return (
    <View className="basis-[30%] items-center gap-1 rounded-2xl bg-white/5 py-3 ">
      <Icon color={color} size={16} />
      <Text className="text-sm font-bold text-white">
        {Math.round(value)}
        {unit}
      </Text>
      <Text className="text-[10px] text-text-secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type CopyTarget = { kind: 'entry'; entryId: string } | { kind: 'meal' };

function CopySheet({
  date,
  targetKind,
  onConfirm,
  onClose,
}: {
  date: string;
  targetKind: CopyTarget['kind'];
  onConfirm: (toDate: string) => void;
  onClose: () => void;
}) {
  const [toDate, setToDate] = useState(date);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-secondary">
          {targetKind === 'meal' ? 'Ganze Mahlzeit kopieren nach' : 'Eintrag kopieren nach'}
        </Text>
        <Pressable onPress={onClose}>
          <X color="#A1A1AA" size={16} />
        </Pressable>
      </View>
      <DateField value={toDate} onChange={setToDate} />
      <View className="flex-row gap-3">
        <Button label="Abbrechen" variant="secondary" onPress={onClose} className="flex-1" />
        <Button label="Kopieren" icon={<Copy color="#ffffff" size={16} />} onPress={() => onConfirm(toDate)} className="flex-1" />
      </View>
    </Card>
  );
}

export default function MealDetailScreen() {
  const params = useLocalSearchParams<{ mealType: MealType }>();
  const mealType = params.mealType ?? 'breakfast';
  const date = useUiStore((state) => state.selectedDate);
  const entries = useDiaryStore((state) => state.entriesByDate[date] ?? EMPTY_ENTRIES).filter(
    (entry) => entry.mealType === mealType,
  );
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null);

  const totalKcal = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const nutrientAmounts = sumEntryNutrients(entries);
  const visibleNutrientKeys = NUTRIENT_ORDER.filter((key) => visibleNutrients[key]);

  async function handleConfirmCopy(toDate: string) {
    const target = copyTarget;
    if (!target) return;
    setCopyTarget(null);
    try {
      if (target.kind === 'entry') {
        await copyEntryAndSync(date, target.entryId, toDate);
      } else {
        await copyMealAndSync(date, mealType, toDate);
      }
      useToastStore.getState().show(`Nach ${formatDateShort(toDate)} kopiert.`, 'success');
    } catch {
      // Failure toast already shown inside addMealsAndSync.
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-white">
            {MEAL_LABELS[mealType]}
          </Text>
          <Text className="text-xs text-text-secondary">
            {entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}` : 'Noch keine Einträge'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {entries.length > 0 && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-white/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
              onPress={() => setCopyTarget({ kind: 'meal' })}
              accessibilityLabel="Ganze Mahlzeit kopieren"
            >
              <Copy color="#A1A1AA" size={16} />
            </Pressable>
          )}
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-white/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
            onPress={() => router.back()}
          >
            <X color="#A1A1AA" size={18} />
          </Pressable>
        </View>
      </View>

      {copyTarget && (
        <View className="px-6 pt-4">
          <CopySheet date={date} targetKind={copyTarget.kind} onConfirm={handleConfirmCopy} onClose={() => setCopyTarget(null)} />
        </View>
      )}

      <View className="mx-6 mt-4 gap-3 rounded-[28px] border border-surface-border bg-surface p-4 shadow-md shadow-black/20 backdrop-blur-xl  ">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-secondary">{MEAL_LABELS[mealType]} gesamt</Text>
          <Text className="text-lg font-bold tracking-tight text-white">{Math.round(totalKcal)} kcal</Text>
        </View>
        {visibleNutrientKeys.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {visibleNutrientKeys.map((key) => (
              <NutrientStat key={key} nutrientKey={key} value={nutrientAmounts[key]} />
            ))}
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-6 pt-4" contentContainerClassName="gap-2 pb-6">
        {entries.length === 0 ? (
          <Text className="pt-8 text-center text-sm text-text-secondary">
            Für {MEAL_LABELS[mealType]} wurde an diesem Tag noch nichts eingetragen.
          </Text>
        ) : (
          entries.map((entry) => (
            <Pressable
              key={entry.id}
              className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface px-4 py-3 shadow-md shadow-black/20 backdrop-blur-xl transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80  "
              onPress={() => router.push({ pathname: '/edit-meal-entry', params: { entryId: entry.id } })}
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                  {entry.foodItem.name}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {formatAmount(entry)} · {Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable
                  className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80"
                  onPress={() => setCopyTarget({ kind: 'entry', entryId: entry.id })}
                  accessibilityLabel="Eintrag kopieren"
                >
                  <Copy color="#6366F1" size={14} />
                </Pressable>
                <Pressable
                  className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80"
                  onPress={() => {
                    // Failure alert already shown inside removeMealAndSync; this
                    // just avoids an unhandled-rejection warning at the call site.
                    removeMealAndSync(date, entry.id).catch(() => {});
                  }}
                >
                  <Trash2 color="#ef4444" size={16} />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View className="gap-3 px-6 pb-8 pt-3">
        <View className="flex-row gap-3">
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-2xl border border-surface-border bg-surface shadow-md shadow-black/20 backdrop-blur-xl active:opacity-80  "
            onPress={() => router.push({ pathname: '/analyze-food', params: { mealType } })}
          >
            <Camera color="#6366F1" size={20} />
          </Pressable>
          <Button
            label="Lebensmittel hinzufügen"
            icon={<Plus color="#ffffff" size={18} />}
            onPress={() => router.push({ pathname: '/add-food', params: { mealType } })}
            className="flex-1"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
