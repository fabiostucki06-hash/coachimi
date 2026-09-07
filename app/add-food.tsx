import { router, useLocalSearchParams } from 'expo-router';
import { Barcode, Plus, Search, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonListRow } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { fuzzyFilterFoodItems, normalizeSearchText, searchLocalFoods } from '@/data/foodDatabase';
import { FoodApiError, FoodApiUnavailableError, searchFood } from '@/services/foodApi';
import { getCachedSearch, setCachedSearch } from '@/services/searchCache';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { getRecentFoods } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';
import type { FoodItem, MealType } from '@/types';

const SOURCE_BADGES: Partial<Record<NonNullable<FoodItem['source']>, string>> = {
  local: 'Standard',
  recent: 'Zuletzt',
  custom: 'Eigene',
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

// Strict debounce on the search input so fast typing never fires a request per keystroke.
const DEBOUNCE_MS = 300;

interface Notice {
  message: string;
  severity: 'warning' | 'error';
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function mergeUnique(lists: FoodItem[][]): FoodItem[] {
  const seen = new Set<string>();
  const merged: FoodItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = normalizeSearchText(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ mealType: MealType }>();
  const mealType = params.mealType ?? 'breakfast';
  const setPendingSelection = useUiStore((state) => state.setPendingSelection);
  const customFoods = useCustomFoodStore((state) => state.customFoods);
  const addCustomFood = useCustomFoodStore((state) => state.addCustomFood);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customKcal, setCustomKcal] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customFiber, setCustomFiber] = useState('');

  // Filtering/merging on every keystroke can get expensive as the custom-food and recent
  // lists grow - marking the result update as a transition keeps the TextInput itself
  // (an urgent update) rendering at 60fps even while a heavier merge is still computing.
  const [, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      requestIdRef.current += 1;
      setResults([]);
      setNotice(null);
      setLoading(false);
      return;
    }

    // Instant, offline results: recently-logged foods and this user's own custom foods
    // first (most relevant), then the common-foods DB - all in-memory, so this renders
    // on the same tick as the keystroke, before any network round-trip is even considered.
    const recentMatches = fuzzyFilterFoodItems(trimmed, getRecentFoods());
    const customMatches = fuzzyFilterFoodItems(trimmed, customFoods);
    const commonMatches = searchLocalFoods(trimmed);
    const localMatches = mergeUnique([recentMatches, customMatches, commonMatches]);
    startTransition(() => {
      setResults(localMatches);
      setNotice(null);
    });

    // Enough local matches already — skip the remote round-trip entirely
    // (also keeps us under Open Food Facts' rate limit while typing).
    if (localMatches.length >= 3) {
      requestIdRef.current += 1;
      setLoading(false);
      return;
    }

    const normalizedQuery = normalizeSearchText(trimmed);
    const cached = getCachedSearch(normalizedQuery);
    if (cached) {
      requestIdRef.current += 1;
      startTransition(() => setResults(mergeUnique([localMatches, cached])));
      setLoading(false);
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const remoteItems = await searchFood(trimmed, controller.signal);
        if (requestIdRef.current !== requestId) return;
        setCachedSearch(normalizedQuery, remoteItems);
        startTransition(() => {
          setResults(mergeUnique([localMatches, remoteItems]));
          setNotice(null);
        });
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof FoodApiUnavailableError) {
          setNotice({ message: err.message, severity: 'warning' });
        } else {
          setNotice({
            message: err instanceof FoodApiError ? err.message : 'Unbekannter Fehler bei der Suche.',
            severity: 'error',
          });
        }
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, customFoods]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function handleSelect(item: FoodItem) {
    setPendingSelection(item, mealType);
    router.push('/log-quantity');
  }

  function handleClose() {
    router.back();
  }

  function handleOpenCustomForm() {
    setCustomName(query.trim());
    setCustomBrand('');
    setCustomKcal('');
    setCustomCarbs('');
    setCustomProtein('');
    setCustomFat('');
    setCustomFiber('');
    setShowCustomForm(true);
  }

  function handleCustomFoodContinue() {
    const trimmedName = customName.trim();
    if (!trimmedName) return;

    // Persisted (not a one-off): shows up at the top of future searches for this user.
    const foodItem = addCustomFood({
      name: trimmedName,
      brand: customBrand.trim() || undefined,
      caloriesPerServing: parseNumber(customKcal, 0),
      macrosPerServing: {
        carbs: parseNumber(customCarbs, 0),
        protein: parseNumber(customProtein, 0),
        fat: parseNumber(customFat, 0),
      },
      micronutrientsPerServing: { fiber: parseNumber(customFiber, 0), sugar: 0, sodium: 0, vitaminC: 0 },
      servingSize: 100,
      servingUnit: 'g',
    });

    setShowCustomForm(false);
    handleSelect(foodItem);
  }

  const showEmptyState = !loading && query.trim().length > 0 && results.length === 0;
  const showSkeletons = loading && query.trim().length > 0 && results.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Lebensmittel hinzufügen</Text>
          <Text className="text-xs text-slate-400">{MEAL_LABELS[mealType]}</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-slate-200/50 bg-slate-100/60 backdrop-blur-md transition-all duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
          onPress={handleClose}
        >
          <X color="#64748b" size={18} />
        </Pressable>
      </View>

      <View className="gap-3 px-6 pt-4">
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl transition-shadow duration-200 ease-in-out dark:border-slate-800/60 dark:bg-slate-900/60">
          <Search color="#94a3b8" size={18} />
          <TextInput
            className="flex-1 text-base text-slate-900 dark:text-white"
            placeholder="Lebensmittel suchen..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowCustomForm(false);
            }}
            autoFocus
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color="#10b981" />}
          {!loading && query.length > 0 && (
            <Pressable
              className="h-6 w-6 items-center justify-center rounded-full bg-slate-100/80 transition-colors duration-150 ease-in-out active:opacity-70 dark:bg-white/10"
              onPress={() => {
                setQuery('');
                setShowCustomForm(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Suche leeren"
            >
              <X color="#64748b" size={12} />
            </Pressable>
          )}
        </View>

        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 shadow-md shadow-emerald-500/20 transition-all duration-150 ease-in-out active:scale-[0.98] active:opacity-90 active:bg-emerald-600"
            onPress={() => router.push({ pathname: '/barcode-scanner', params: { mealType } })}
          >
            <Barcode color="#ffffff" size={18} />
            <Text className="text-base font-semibold text-white">Barcode</Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-5 py-3.5 shadow-sm shadow-slate-900/5 backdrop-blur-xl transition-all duration-150 ease-in-out active:scale-[0.98] active:opacity-80 dark:border-slate-800/60 dark:bg-slate-900/60"
            onPress={() => router.push({ pathname: '/meal-parser', params: { mealType } })}
          >
            <Sparkles color="#10b981" size={18} />
            <Text className="text-base font-semibold text-emerald-600 dark:text-emerald-400">KI-Text</Text>
          </Pressable>
        </View>

        <Pressable
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300/70 px-4 py-2.5 active:opacity-70 dark:border-slate-700/70"
          onPress={() => setShowCustomForm((prev) => !prev)}
        >
          <Plus color="#10b981" size={16} />
          <Text className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Eigenes Lebensmittel erstellen</Text>
        </Pressable>

        {showCustomForm && (
          <Card className="gap-4">
            <TextField label="Name" value={customName} onChangeText={setCustomName} placeholder="z. B. Omas Kuchen" autoFocus />
            <TextField label="Marke (optional)" value={customBrand} onChangeText={setCustomBrand} placeholder="z. B. Bio-Hof Müller" />
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Nährwerte pro 100g</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Kcal" keyboardType="decimal-pad" value={customKcal} onChangeText={setCustomKcal} />
              </View>
              <View className="flex-1">
                <TextField label="Carbs" keyboardType="decimal-pad" value={customCarbs} onChangeText={setCustomCarbs} suffix="g" />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Protein" keyboardType="decimal-pad" value={customProtein} onChangeText={setCustomProtein} suffix="g" />
              </View>
              <View className="flex-1">
                <TextField label="Fett" keyboardType="decimal-pad" value={customFat} onChangeText={setCustomFat} suffix="g" />
              </View>
            </View>
            <TextField label="Ballaststoffe (optional)" keyboardType="decimal-pad" value={customFiber} onChangeText={setCustomFiber} suffix="g" />
            <Button label="Weiter" onPress={handleCustomFoodContinue} disabled={!customName.trim()} />
          </Card>
        )}
      </View>

      {notice && (
        <Text className={`px-6 pt-4 text-sm ${notice.severity === 'error' ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
          {notice.message}
        </Text>
      )}

      <FlatList
        className="flex-1 px-6 pt-4"
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-12"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          showSkeletons ? (
            <View className="gap-2">
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </View>
          ) : showEmptyState ? (
            <View className="items-center gap-4 pt-8">
              <Text className="text-center text-sm text-slate-400">Keine Ergebnisse gefunden</Text>
              {!showCustomForm && (
                <Pressable
                  className="flex-row items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 active:opacity-80"
                  onPress={handleOpenCustomForm}
                >
                  <Plus color="#10b981" size={16} />
                  <Text className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Eigenes Lebensmittel hinzufügen
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-row items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl transition-all duration-150 ease-in-out active:scale-[0.98] active:opacity-80 dark:border-slate-800/60 dark:bg-slate-900/60"
            onPress={() => handleSelect(item)}
          >
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.source && SOURCE_BADGES[item.source] && (
                  <View className="rounded-full bg-emerald-500/10 px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {SOURCE_BADGES[item.source]}
                    </Text>
                  </View>
                )}
              </View>
              {item.brand && (
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {item.brand}
                </Text>
              )}
            </View>
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              {item.caloriesPerServing} kcal / {item.servingSize}{item.servingUnit}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
