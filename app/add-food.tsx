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
import { FoodApiError, FoodApiUnavailableError, looksLikeBarcode, upsertCommunityBarcode } from '@/services/foodApi';
import { getDietCompliance, rankFoodsForDiet } from '@/services/dietEngine';
import { cacheFoodItem, searchFoodHybrid } from '@/services/foodSearch';
import { getCachedSearch, setCachedSearch } from '@/services/searchCache';
import { prefetchSwissStaples } from '@/services/staplePrefetch';
import { useCustomFoodStore } from '@/store/customFoodStore';
import { getRecentFoods } from '@/store/diaryStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { FoodItem, MealType } from '@/types';

const SOURCE_BADGES: Partial<Record<NonNullable<FoodItem['source']>, string>> = {
  local: 'Standard',
  recent: 'Zuletzt',
  custom: 'Eigene',
  ai: 'KI-Schätzung',
  community: 'Community',
  usda: 'USDA Verifiziert',
  fatsecret: 'FatSecret',
};

/** Only 'priority' gets a badge - 'neutral' stays unlabeled and 'avoid' is de-prioritized by sort order alone (see rankFoodsForDiet), not called out negatively in the UI. */
const DIET_PRIORITY_BADGE = 'Passt zu deiner Diät';

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
  const params = useLocalSearchParams<{ mealType: MealType; barcode?: string }>();
  const mealType = params.mealType ?? 'breakfast';
  const prefillBarcode = params.barcode?.trim() || undefined;
  const setPendingSelection = useUiStore((state) => state.setPendingSelection);
  const customFoods = useCustomFoodStore((state) => state.customFoods);
  const addCustomFood = useCustomFoodStore((state) => state.addCustomFood);
  const dietType = useUserStore((state) => state.user.dietType) ?? 'balanced';
  const gender = useUserStore((state) => state.user.gender);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  // Snapshot at mount - a "recently used" quick-pick row shown before the user types
  // anything, so re-logging the same handful of foods doesn't need a search each time.
  const [recentFoods] = useState<FoodItem[]>(() => getRecentFoods(8));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    prefillBarcode ? { message: `Barcode ${prefillBarcode} wurde in keiner Datenbank gefunden. Bitte trag das Produkt einmalig ein.`, severity: 'warning' } : null,
  );
  const [showCustomForm, setShowCustomForm] = useState(Boolean(prefillBarcode));
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customBarcode, setCustomBarcode] = useState(prefillBarcode ?? '');
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
      setResults(rankFoodsForDiet(localMatches, dietType, gender));
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
      startTransition(() => setResults(rankFoodsForDiet(mergeUnique([localMatches, cached]), dietType, gender)));
      setLoading(false);
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const remoteItems = await searchFoodHybrid(trimmed, controller.signal);
        if (requestIdRef.current !== requestId) return;
        setCachedSearch(normalizedQuery, remoteItems);
        startTransition(() => {
          setResults(rankFoodsForDiet(mergeUnique([localMatches, remoteItems]), dietType, gender));
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
  }, [query, customFoods, dietType, gender]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Best-effort, at most once a day (see staplePrefetch.ts) - seeds the offline
  // barcode cache with Swiss retailer staples so scanning one of them later works
  // even without connectivity. Never awaited: must never delay this screen's mount.
  useEffect(() => {
    prefetchSwissStaples().catch(() => {});
  }, []);

  function handleSelect(item: FoodItem) {
    // Auto-caching: an Open Food Facts/FatSecret/USDA pick lands in the local
    // `foods` table (Tier 1) so the next search for it is instant. No-op for
    // every other source.
    cacheFoodItem(item).catch(() => {});
    setPendingSelection(item, mealType);
    router.push('/log-quantity');
  }

  function handleClose() {
    router.back();
  }

  function handleOpenCustomForm() {
    const trimmedQuery = query.trim();
    // A barcode typed straight into the search bar (rather than scanned) hits the
    // same "not found" empty state - pre-fill it as a barcode, not as the product
    // name, so the 404 fallback stays seamless either way.
    const typedBarcode = looksLikeBarcode(trimmedQuery) ? trimmedQuery : undefined;
    setCustomName(typedBarcode ? '' : trimmedQuery);
    setCustomBrand('');
    setCustomBarcode(prefillBarcode ?? typedBarcode ?? '');
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

    // Community Contribution Engine: only a barcode-linked entry gets cached - a
    // barcode-less custom food has nothing to key the shared cache on.
    const trimmedBarcode = customBarcode.trim();
    if (trimmedBarcode) {
      upsertCommunityBarcode(trimmedBarcode, foodItem).catch(() => {});
    }

    setShowCustomForm(false);
    handleSelect(foodItem);
  }

  const isSearching = query.trim().length > 0;
  const showEmptyState = !loading && isSearching && results.length === 0;
  const showSkeletons = loading && isSearching && results.length === 0;
  const listData = isSearching ? results : recentFoods;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-foreground">Lebensmittel hinzufügen</Text>
          <Text className="text-xs text-text-secondary">{MEAL_LABELS[mealType]}</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
          onPress={handleClose}
        >
          <X color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      <View className="gap-3 px-6 pt-4">
        <View className="flex-row items-center gap-2 rounded-2xl border border-surface-border bg-surface px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-xl transition-shadow duration-200 ease-in-out  ">
          <Search color="#A1A1AA" size={18} />
          <TextInput
            className="flex-1 text-base text-foreground"
            placeholder="Lebensmittel suchen..."
            placeholderTextColor="#A1A1AA"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowCustomForm(false);
            }}
            autoFocus
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color="#6366F1" />}
          {!loading && query.length > 0 && (
            <Pressable
              className="h-6 w-6 items-center justify-center rounded-full bg-overlay/10 transition-colors duration-150 ease-in-out active:opacity-70 "
              onPress={() => {
                setQuery('');
                setShowCustomForm(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Suche leeren"
            >
              <X color="#A1A1AA" size={12} />
            </Pressable>
          )}
        </View>

        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 shadow-md shadow-primary/20 transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-90 active:bg-[#4F46E5]"
            onPress={() => router.push({ pathname: '/barcode-scanner', params: { mealType } })}
          >
            <Barcode color="#ffffff" size={18} />
            <Text className="text-base font-semibold text-white">Barcode</Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface px-5 py-3.5 shadow-sm shadow-black/20 backdrop-blur-xl transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80  "
            onPress={() => router.push({ pathname: '/meal-parser', params: { mealType } })}
          >
            <Sparkles color="#6366F1" size={18} />
            <Text className="text-base font-semibold text-primary">KI-Text</Text>
          </Pressable>
        </View>

        <Pressable
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-border px-4 py-2.5 active:opacity-70 "
          onPress={() => setShowCustomForm((prev) => !prev)}
        >
          <Plus color="#6366F1" size={16} />
          <Text className="text-sm font-medium text-primary">Eigenes Lebensmittel erstellen</Text>
        </Pressable>
      </View>

      {notice && (
        <Text className={`px-6 pt-4 text-sm ${notice.severity === 'error' ? 'text-red-500' : 'text-amber-400'}`}>
          {notice.message}
        </Text>
      )}

      <FlatList
        className="flex-1 px-6 pt-4"
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-12"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {showCustomForm && (
              // Part of the FlatList's own scrollable content (not the fixed section
              // above) - this form has enough fields to exceed the screen with the
              // keyboard open, and living outside any scroll container used to leave
              // it completely unscrollable while typing.
              <Card className="mb-4 gap-4">
                <TextField label="Name" value={customName} onChangeText={setCustomName} placeholder="z. B. Omas Kuchen" autoFocus={!prefillBarcode} />
                <TextField label="Marke (optional)" value={customBrand} onChangeText={setCustomBrand} placeholder="z. B. Bio-Hof Müller" />
                <TextField
                  label="Barcode (optional)"
                  value={customBarcode}
                  onChangeText={setCustomBarcode}
                  placeholder="z. B. 4008400123456"
                  keyboardType="number-pad"
                />
                <Text className="text-xs font-medium text-text-secondary">Nährwerte pro 100g</Text>
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
            {!isSearching && recentFoods.length > 0 && (
              <Text className="pb-2 text-xs font-medium text-text-secondary">Zuletzt verwendet</Text>
            )}
          </>
        }
        ListEmptyComponent={
          showSkeletons ? (
            <View className="gap-2">
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </View>
          ) : showEmptyState ? (
            <View className="items-center gap-4 pt-8">
              <Text className="text-center text-sm text-text-secondary">Lebensmittel nicht gefunden?</Text>
              {!showCustomForm && (
                <Pressable
                  className="flex-row items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-4 py-2 active:opacity-80"
                  onPress={handleOpenCustomForm}
                >
                  <Plus color="#6366F1" size={16} />
                  <Text className="text-sm font-medium text-primary">
                    Selbst erstellen
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-row items-start justify-between rounded-2xl border border-surface-border bg-surface px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-xl transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80  "
            onPress={() => handleSelect(item)}
          >
            <View className="flex-1 min-w-0 gap-1 pr-3">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                {item.name}
              </Text>
              {((item.source && SOURCE_BADGES[item.source]) || getDietCompliance(item, dietType) === 'priority') && (
                <View className="flex-row flex-wrap items-center gap-2">
                  {item.source && SOURCE_BADGES[item.source] && (
                    <View className="rounded-full bg-primary/10 px-2 py-0.5">
                      <Text className="text-[10px] font-medium text-primary">
                        {SOURCE_BADGES[item.source]}
                      </Text>
                    </View>
                  )}
                  {getDietCompliance(item, dietType) === 'priority' && (
                    <View className="rounded-full bg-emerald-500/10 px-2 py-0.5">
                      <Text className="text-[10px] font-medium text-emerald-400">{DIET_PRIORITY_BADGE}</Text>
                    </View>
                  )}
                </View>
              )}
              {item.brand && (
                <Text className="text-xs text-text-secondary" numberOfLines={1}>
                  {item.brand}
                </Text>
              )}
            </View>
            <Text className="shrink-0 text-sm text-text-secondary" numberOfLines={1}>
              {item.caloriesPerServing} kcal / {item.servingSize}{item.servingUnit}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
