import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Camera, Check, ImagePlus, Minus, Plus, RotateCcw, Search, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { addMealsAndSync } from '@/services/diaryActions';
import { searchFoodHybrid } from '@/services/foodSearch';
import { correctedValuesFromMatch, matchDetectedFoods } from '@/services/photoMatcher';
import { analyzeFoodPhoto, type DetectedFoodItem, type VisionAnalysisResult } from '@/services/visionFoodApi';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { FoodItem, MealType, Micronutrients } from '@/types';
import { getNetCarbs, usesNetCarbs } from '@/utils/nutritionCalculator';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
  drinks: 'Getränke',
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.8,
  allowsEditing: true,
  aspect: [4, 3],
};

// Cap the longest edge before sending to the Vision API: large enough to keep
// ingredient-level detail, small enough to keep payloads fast over mobile networks.
const MAX_ANALYSIS_DIMENSION = 1024;
const ANALYSIS_JPEG_QUALITY = 0.8;
const GRAM_STEP = 10;

/**
 * 'matching' while services/photoMatcher.ts's DB/USDA cross-check is still in
 * flight for this item, 'manual' for a user-added blank item (never matched
 * at all), 'db_verified'/'ai_estimate' once matching has resolved either way.
 */
type MatchStatus = 'manual' | 'matching' | 'db_verified' | 'ai_estimate';

interface EditableItem {
  id: string;
  name: string;
  cookingMethod: string | null;
  grams: string;
  kcalPer100g: string;
  carbsPer100g: string;
  proteinPer100g: string;
  fatPer100g: string;
  micronutrientsPer100g: Micronutrients;
  confidence: number;
  needsVerification: boolean;
  matchStatus: MatchStatus;
  matchScore: number;
  dbCandidate: FoodItem | null;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toEditableItem(detected: DetectedFoodItem, index: number): EditableItem {
  return {
    id: `item-${index}-${Date.now()}`,
    name: detected.name,
    cookingMethod: detected.cookingMethod,
    grams: String(Math.round(detected.estimatedGrams)),
    kcalPer100g: String(Math.round(detected.caloriesPer100g)),
    carbsPer100g: String(Math.round(detected.macrosPer100g.carbs)),
    proteinPer100g: String(Math.round(detected.macrosPer100g.protein)),
    fatPer100g: String(Math.round(detected.macrosPer100g.fat)),
    micronutrientsPer100g: detected.micronutrientsPer100g,
    confidence: detected.confidence,
    needsVerification: detected.needsVerification,
    matchStatus: 'matching',
    matchScore: 0,
    dbCandidate: null,
  };
}

function makeBlankItem(): EditableItem {
  return {
    id: `manual-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    name: '',
    cookingMethod: null,
    grams: '100',
    kcalPer100g: '',
    carbsPer100g: '',
    proteinPer100g: '',
    fatPer100g: '',
    micronutrientsPer100g: { fiber: 0, sugar: 0, sodium: 0, vitaminC: 0 },
    confidence: 1,
    needsVerification: false,
    matchStatus: 'manual',
    matchScore: 0,
    dbCandidate: null,
  };
}

const PRECISION_SEARCH_DEBOUNCE_MS = 300;
const PRECISION_SEARCH_RESULT_LIMIT = 5;

/**
 * "Precision Edit" - lets the user override an AI-detected/auto-matched item with an
 * EXACT DB entry of their own choosing, rather than trusting the Vision model's guess
 * or the best-effort auto-match (services/photoMatcher.ts). Self-contained (own
 * debounce, own AbortController) so each item card can open one independently.
 */
function PrecisionSearchPanel({ onSelect, onClose }: { onSelect: (food: FoodItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const found = await searchFoodHybrid(trimmed, controller.signal);
        setResults(found.slice(0, PRECISION_SEARCH_RESULT_LIMIT));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, PRECISION_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <View className="gap-2 rounded-2xl border border-surface-border bg-white/5 p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-text-secondary">Genauen DB-Eintrag suchen</Text>
        <Pressable onPress={onClose} accessibilityLabel="Suche schließen" className="h-6 w-6 items-center justify-center rounded-full bg-white/10 active:opacity-70">
          <X color="#A1A1AA" size={12} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2">
        <Search color="#A1A1AA" size={14} />
        <TextInput
          className="flex-1 text-sm text-white"
          placeholder="z. B. Basmati Reis gekocht"
          placeholderTextColor="#A1A1AA"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {loading && <ActivityIndicator size="small" color="#6366F1" />}
      </View>
      {results.map((result) => (
        <Pressable
          key={result.id}
          className="flex-row items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 active:opacity-80"
          onPress={() => onSelect(result)}
        >
          <Text className="flex-1 text-xs font-medium text-white" numberOfLines={1}>
            {result.name}
          </Text>
          <Text className="text-[11px] text-text-secondary">
            {Math.round(result.caloriesPerServing)} kcal/{result.servingSize}
            {result.servingUnit}
          </Text>
        </Pressable>
      ))}
      {!loading && query.trim().length > 0 && results.length === 0 && (
        <Text className="px-1 text-xs text-text-secondary">Keine Treffer.</Text>
      )}
    </View>
  );
}

/** Resizes/recompresses the picked photo before it's sent to the Vision API. Falls back to the picker's own base64 if manipulation fails for any reason. */
async function prepareImageForAnalysis(picked: ImagePicker.ImagePickerAsset): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(picked.uri);
    if (picked.width > MAX_ANALYSIS_DIMENSION) {
      context.resize({ width: MAX_ANALYSIS_DIMENSION });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: ANALYSIS_JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
    return saved.base64 ?? picked.base64 ?? null;
  } catch {
    return picked.base64 ?? null;
  }
}

export default function AnalyzeFoodScreen() {
  const params = useLocalSearchParams<{ mealType: MealType }>();
  const mealType = params.mealType ?? 'breakfast';
  const selectedDate = useUiStore((state) => state.selectedDate);
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);
  const dietType = useUserStore((state) => state.user.dietType) ?? 'balanced';
  const showNetCarbs = usesNetCarbs(dietType);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<VisionAnalysisResult['source'] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [precisionEditItemId, setPrecisionEditItemId] = useState<string | null>(null);

  async function runAnalysis(picked: ImagePicker.ImagePickerAsset) {
    setImageUri(picked.uri);
    setItems([]);
    setAnalysisSource(null);
    setNotice(null);
    setConfidenceScore(null);
    setReasoning(null);
    setPickerError(null);

    const base64 = await prepareImageForAnalysis(picked);
    if (!base64) {
      setPickerError('Foto konnte nicht gelesen werden. Bitte ein anderes Bild versuchen.');
      return;
    }

    setAnalyzing(true);
    try {
      const analysis = await analyzeFoodPhoto(base64);
      setAnalysisSource(analysis.source);
      setNotice(analysis.notice);
      setConfidenceScore(analysis.confidenceScore);
      setReasoning(analysis.reasoning);
      const mapped = analysis.items.map(toEditableItem);
      setItems(mapped);
      if (mapped.length > 0) {
        void runMatching(
          analysis.items,
          mapped.map((item) => item.id),
        );
      }
    } catch {
      setPickerError('Die Bildanalyse ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setAnalyzing(false);
    }
  }

  /**
   * Cross-checks each detected item against the local DB/USDA pipeline
   * (services/photoMatcher.ts) in the background - the analysis screen already
   * rendered the AI's own estimate, this only upgrades it once matches come back.
   * A HIGH-confidence match (score >= AUTO_APPLY_MATCH_THRESHOLD, see
   * correctedValuesFromMatch) silently recalculates the full macro/micro profile -
   * calories, protein, carbs, fat AND every micronutrient - from the DB candidate's
   * accurate per-100g values, not just a couple of fields; a merely close-enough
   * match (below that bar but still db_verified) only auto-corrects Eisen/Zucker,
   * the values the Vision model tends to guess worst on, and leaves the rest for a
   * manual "Übernehmen"/Precision Edit; a low/no match leaves the AI estimate
   * untouched entirely - the fallback path photoMatcher.ts itself guarantees.
   */
  async function runMatching(detectedItems: DetectedFoodItem[], editableIds: string[]) {
    const matches = await matchDetectedFoods(detectedItems);
    setItems((prev) =>
      prev.map((item) => {
        const index = editableIds.indexOf(item.id);
        if (index === -1) return item;
        const match = matches[index];
        if (match.status !== 'db_verified' || !match.candidate) {
          return { ...item, matchStatus: 'ai_estimate', matchScore: match.score, dbCandidate: null };
        }

        const corrected = correctedValuesFromMatch(match);
        if (corrected) {
          return {
            ...item,
            matchStatus: 'db_verified',
            matchScore: match.score,
            dbCandidate: match.candidate,
            kcalPer100g: String(Math.round(corrected.caloriesPer100g)),
            carbsPer100g: String(Math.round(corrected.macrosPer100g.carbs)),
            proteinPer100g: String(Math.round(corrected.macrosPer100g.protein)),
            fatPer100g: String(Math.round(corrected.macrosPer100g.fat)),
            micronutrientsPer100g: corrected.micronutrientsPer100g,
            needsVerification: false,
          };
        }

        return {
          ...item,
          matchStatus: 'db_verified',
          matchScore: match.score,
          dbCandidate: match.candidate,
          micronutrientsPer100g: {
            ...item.micronutrientsPer100g,
            iron: match.candidate.micronutrientsPerServing.iron ?? item.micronutrientsPer100g.iron,
            sugar: match.candidate.micronutrientsPerServing.sugar ?? item.micronutrientsPer100g.sugar,
          },
        };
      }),
    );
  }

  /** Full swap onto an exact DB item's values (name + all macros/micros), keeping the user's currently edited gram amount. Used both by the auto-matched "Übernehmen" pill and by Precision Edit's manual search. */
  function applyFoodItem(itemId: string, food: FoodItem) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              name: food.name,
              kcalPer100g: String(Math.round(food.caloriesPerServing)),
              carbsPer100g: String(Math.round(food.macrosPerServing.carbs)),
              proteinPer100g: String(Math.round(food.macrosPerServing.protein)),
              fatPer100g: String(Math.round(food.macrosPerServing.fat)),
              micronutrientsPer100g: food.micronutrientsPerServing,
              matchStatus: 'db_verified',
              matchScore: 1,
              dbCandidate: food,
              needsVerification: false,
            }
          : item,
      ),
    );
    setPrecisionEditItemId(null);
  }

  async function handleTakePhoto() {
    setPickerError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPickerError('Kamera-Zugriff wurde nicht erlaubt.');
        return;
      }
      const picked = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
      if (!picked.canceled && picked.assets[0]) {
        await runAnalysis(picked.assets[0]);
      }
    } catch {
      setPickerError('Kamera konnte nicht geöffnet werden.');
    }
  }

  async function handlePickFromLibrary() {
    setPickerError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPickerError('Zugriff auf die Fotomediathek wurde nicht erlaubt.');
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      if (!picked.canceled && picked.assets[0]) {
        await runAnalysis(picked.assets[0]);
      }
    } catch {
      setPickerError('Foto konnte nicht ausgewählt werden. Möglicherweise ein nicht unterstütztes Format.');
    }
  }

  function handleReset() {
    setImageUri(null);
    setItems([]);
    setAnalysisSource(null);
    setNotice(null);
    setConfidenceScore(null);
    setReasoning(null);
    setPickerError(null);
  }

  function handleClose() {
    router.back();
  }

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addManualItem() {
    setItems((prev) => [...prev, makeBlankItem()]);
  }

  // Recomputes from each item's current grams input on every keystroke - the "instant
  // real-time update" for editable weight the Precision Edit / weight-entry UI relies on.
  const itemTotals = useMemo(
    () =>
      items.map((item) => {
        const grams = parseNumber(item.grams, 0);
        const factor = grams / 100;
        const carbs = parseNumber(item.carbsPer100g, 0) * factor;
        const fiber = (item.micronutrientsPer100g.fiber ?? 0) * factor;
        return {
          id: item.id,
          grams,
          kcal: parseNumber(item.kcalPer100g, 0) * factor,
          carbs,
          netCarbs: getNetCarbs(carbs, fiber),
          protein: parseNumber(item.proteinPer100g, 0) * factor,
          fat: parseNumber(item.fatPer100g, 0) * factor,
          fiber,
          sugar: (item.micronutrientsPer100g.sugar ?? 0) * factor,
          iron: (item.micronutrientsPer100g.iron ?? 0) * factor,
        };
      }),
    [items],
  );

  const grandTotal = useMemo(
    () =>
      itemTotals.reduce(
        (sum, t) => ({
          kcal: sum.kcal + t.kcal,
          carbs: sum.carbs + t.carbs,
          netCarbs: sum.netCarbs + t.netCarbs,
          protein: sum.protein + t.protein,
          fat: sum.fat + t.fat,
          fiber: sum.fiber + t.fiber,
          sugar: sum.sugar + t.sugar,
          iron: sum.iron + t.iron,
        }),
        { kcal: 0, carbs: 0, netCarbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0, iron: 0 },
      ),
    [itemTotals],
  );

  const validItemCount = items.filter((item) => item.name.trim() && parseNumber(item.grams, 0) > 0).length;

  async function handleSave() {
    if (validItemCount === 0 || saving) return;

    const meals = items.flatMap((item) => {
      const grams = parseNumber(item.grams, 0);
      if (!item.name.trim() || grams <= 0) return [];

      const foodItem: FoodItem = {
        id: `vision-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        name: item.name.trim(),
        caloriesPerServing: parseNumber(item.kcalPer100g, 0),
        macrosPerServing: {
          carbs: parseNumber(item.carbsPer100g, 0),
          protein: parseNumber(item.proteinPer100g, 0),
          fat: parseNumber(item.fatPer100g, 0),
        },
        micronutrientsPerServing: item.micronutrientsPer100g,
        servingSize: 100,
        servingUnit: 'g',
        source: item.matchStatus === 'db_verified' && item.dbCandidate ? item.dbCandidate.source : 'ai',
      };

      return [{ foodItem, mealType, servings: grams / 100 }];
    });

    setSaving(true);
    try {
      await addMealsAndSync(selectedDate, meals);
    } catch {
      // Failure alert already shown by addMealsAndSync; stay on screen so the
      // user can retry instead of silently losing the analyzed items.
      setSaving(false);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-white">KI-Foto-Analyse</Text>
          <Text className="text-xs text-text-secondary">{MEAL_LABELS[mealType]}</Text>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-white/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
          onPress={handleClose}
        >
          <X color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pt-4 pb-12">
        {!imageUri ? (
          <View className="gap-4 rounded-[28px] border border-dashed border-surface-border bg-white/5 p-5">
            <View className="items-center gap-1.5 pb-1">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles color="#6366F1" size={20} />
              </View>
              <Text className="text-sm font-semibold text-text-secondary">Mahlzeit fotografieren</Text>
              <Text className="text-center text-xs text-text-secondary">
                Coach imi erkennt Lebensmittel und Nährwerte automatisch.
              </Text>
            </View>
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 shadow-md shadow-primary/20 transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-90 active:bg-[#4F46E5]"
              onPress={handleTakePhoto}
            >
              <Camera color="#ffffff" size={18} />
              <Text className="text-base font-semibold text-white">Foto aufnehmen</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface px-5 py-4 shadow-sm shadow-black/20 backdrop-blur-xl transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80  "
              onPress={handlePickFromLibrary}
            >
              <ImagePlus color="#6366F1" size={18} />
              <Text className="text-base font-semibold text-primary">
                Aus Galerie wählen
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            <View className="aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-surface-border bg-white/10 ">
              <Image source={{ uri: imageUri }} className="h-full w-full" resizeMode="cover" />
            </View>
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface px-4 py-2.5 shadow-sm shadow-black/20 backdrop-blur-xl transition-[transform,opacity] duration-150 ease-in-out active:scale-[0.98] active:opacity-80  "
              onPress={handleReset}
            >
              <RotateCcw color="#A1A1AA" size={16} />
              <Text className="text-sm font-semibold text-text-secondary">Anderes Foto wählen</Text>
            </Pressable>
          </View>
        )}

        {pickerError && <Text className="text-sm text-red-500">{pickerError}</Text>}

        {analyzing && (
          <View className="items-center gap-3 rounded-[28px] border border-surface-border bg-surface p-6 shadow-xl shadow-black/20 backdrop-blur-xl  ">
            <ActivityIndicator color="#6366F1" size="large" />
            <Text className="text-sm text-text-secondary">Mahlzeit wird analysiert...</Text>
          </View>
        )}

        {analysisSource && !analyzing && (
          <>
            <View className="gap-3 rounded-[28px] border border-white/20 bg-primary/90 p-4 shadow-2xl shadow-primary/30 backdrop-blur-xl">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                  <Sparkles color="#ffffff" size={16} />
                </View>
                <Text className="flex-1 text-sm font-semibold text-white">
                  {analysisSource === 'ai'
                    ? `${items.length} Lebensmittel erkannt${
                        confidenceScore != null ? ` · ${Math.round(confidenceScore * 100)}% Konfidenz` : ''
                      }`
                    : 'Keine KI verfügbar – Schätzwerte zum Anpassen'}
                </Text>
              </View>
              {reasoning && <Text className="text-xs text-white/80">{reasoning}</Text>}
            </View>

            {notice && (
              <View className="flex-row items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle color="#d97706" size={16} />
                <Text className="flex-1 text-xs text-amber-400">{notice}</Text>
              </View>
            )}

            {items.length === 0 && (
              <Card className="items-center gap-3">
                <Text className="text-center text-sm text-text-secondary">
                  Es wurde kein Lebensmittel erkannt.
                </Text>
                <Button label="Manuell hinzufügen" variant="secondary" icon={<Plus color="#6366F1" size={16} />} onPress={addManualItem} />
              </Card>
            )}

            {items.map((item, index) => {
              const totals = itemTotals[index];
              return (
                <Card key={item.id} className="gap-4">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <TextField
                        label={`Lebensmittel ${index + 1}`}
                        value={item.name}
                        onChangeText={(text) => updateItem(item.id, { name: text })}
                        placeholder="Name"
                      />
                      {item.cookingMethod && (
                        <Text className="pt-1 text-xs text-text-secondary">Zubereitung: {item.cookingMethod}</Text>
                      )}
                    </View>
                    <Pressable
                      className="mt-6 h-8 w-8 items-center justify-center rounded-full bg-white/5 active:opacity-80 "
                      onPress={() => removeItem(item.id)}
                    >
                      <X color="#A1A1AA" size={14} />
                    </Pressable>
                  </View>

                  {item.needsVerification && (
                    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-amber-500/10 px-2.5 py-1">
                      <AlertTriangle color="#d97706" size={12} />
                      <Text className="text-[11px] font-medium text-amber-400">
                        Unsicher ({Math.round(item.confidence * 100)}% Konfidenz) – bitte prüfen
                      </Text>
                    </View>
                  )}

                  {item.matchStatus === 'matching' && (
                    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white/5 px-2.5 py-1">
                      <ActivityIndicator size="small" color="#A1A1AA" />
                      <Text className="text-[11px] font-medium text-text-secondary">DB-Abgleich läuft …</Text>
                    </View>
                  )}
                  {item.matchStatus === 'db_verified' && (
                    <View className="flex-row items-center justify-between gap-2 rounded-full bg-emerald-500/10 pl-2.5 pr-1.5 py-1">
                      <View className="flex-shrink flex-row items-center gap-1.5">
                        <Check color="#10b981" size={12} />
                        <Text className="text-[11px] font-medium text-emerald-400" numberOfLines={1}>
                          DB Verified{item.dbCandidate ? ` · ${item.dbCandidate.name}` : ''}
                        </Text>
                      </View>
                      {item.dbCandidate && (
                        <Pressable
                          className="rounded-full bg-emerald-500/15 px-2 py-1 active:opacity-70"
                          onPress={() => item.dbCandidate && applyFoodItem(item.id, item.dbCandidate)}
                        >
                          <Text className="text-[11px] font-semibold text-emerald-400">Übernehmen</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  {item.matchStatus === 'ai_estimate' && (
                    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white/5 px-2.5 py-1">
                      <Sparkles color="#A1A1AA" size={12} />
                      <Text className="text-[11px] font-medium text-text-secondary">AI-Schätzung</Text>
                    </View>
                  )}

                  <View className="flex-row flex-wrap gap-1.5">
                    <View className="rounded-full border border-surface-border bg-white/5 px-2.5 py-1">
                      <Text className="text-[11px] font-medium text-text-secondary">Eisen: {totals.iron.toFixed(1)} mg</Text>
                    </View>
                    <View className="rounded-full border border-surface-border bg-white/5 px-2.5 py-1">
                      <Text className="text-[11px] font-medium text-text-secondary">Zucker: {totals.sugar.toFixed(1)} g</Text>
                    </View>
                    <View className="rounded-full border border-surface-border bg-white/5 px-2.5 py-1">
                      <Text className="text-[11px] font-medium text-text-secondary">Ballaststoffe: {totals.fiber.toFixed(1)} g</Text>
                    </View>
                  </View>

                  <Pressable
                    className="flex-row items-center gap-1.5 self-start rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 active:opacity-70"
                    onPress={() => setPrecisionEditItemId((prev) => (prev === item.id ? null : item.id))}
                  >
                    <Search color="#818CF8" size={12} />
                    <Text className="text-[11px] font-semibold text-primary">Precision Edit</Text>
                  </Pressable>
                  {precisionEditItemId === item.id && (
                    <PrecisionSearchPanel
                      onSelect={(food) => applyFoodItem(item.id, food)}
                      onClose={() => setPrecisionEditItemId(null)}
                    />
                  )}

                  <View className="flex-row items-start gap-2">
                    <Pressable
                      className="mt-6 h-[52px] w-10 items-center justify-center rounded-2xl bg-white/5 active:opacity-80 "
                      onPress={() => updateItem(item.id, { grams: String(Math.max(0, parseNumber(item.grams, 0) - GRAM_STEP)) })}
                      accessibilityLabel="Menge verringern"
                    >
                      <Minus color="#A1A1AA" size={16} />
                    </Pressable>
                    <View className="flex-1">
                      <TextField label="Menge" keyboardType="decimal-pad" value={item.grams} onChangeText={(text) => updateItem(item.id, { grams: text })} suffix="g" />
                    </View>
                    <Pressable
                      className="mt-6 h-[52px] w-10 items-center justify-center rounded-2xl bg-white/5 active:opacity-80 "
                      onPress={() => updateItem(item.id, { grams: String(parseNumber(item.grams, 0) + GRAM_STEP) })}
                      accessibilityLabel="Menge erhöhen"
                    >
                      <Plus color="#A1A1AA" size={16} />
                    </Pressable>
                  </View>

                  <Text className="pt-1 text-xs font-medium text-text-secondary">
                    Nährwerte pro 100g (bearbeitbar)
                  </Text>
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

                  <Text className="text-right text-xs text-text-secondary">
                    {Math.round(totals.kcal)} kcal für {Math.round(totals.grams)}g
                    {showNetCarbs ? ` · Netto-Carbs: ${Math.round(totals.netCarbs)}g` : ''}
                  </Text>
                </Card>
              );
            })}

            {items.length > 0 && (
              <Pressable
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface px-4 py-3 shadow-md shadow-black/20 backdrop-blur-xl active:opacity-80  "
                onPress={addManualItem}
              >
                <Plus color="#6366F1" size={16} />
                <Text className="text-sm font-semibold text-primary">
                  Weiteres Lebensmittel hinzufügen
                </Text>
              </Pressable>
            )}

            {items.length > 0 && (
              <Card className="gap-2">
                <Text className="text-sm font-semibold text-text-secondary">Gesamt</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-text-secondary">Kalorien</Text>
                  <Text className="text-base font-bold text-white">
                    {Math.round(grandTotal.kcal)} kcal
                  </Text>
                </View>
                {visibleNutrients.carbs && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">{showNetCarbs ? 'Kohlenhydrate (netto)' : 'Kohlenhydrate'}</Text>
                    <Text className="text-sm text-white">{Math.round(showNetCarbs ? grandTotal.netCarbs : grandTotal.carbs)} g</Text>
                  </View>
                )}
                {visibleNutrients.protein && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">Eiweiß</Text>
                    <Text className="text-sm text-white">{Math.round(grandTotal.protein)} g</Text>
                  </View>
                )}
                {visibleNutrients.fat && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">Fett</Text>
                    <Text className="text-sm text-white">{Math.round(grandTotal.fat)} g</Text>
                  </View>
                )}
                {visibleNutrients.fiber && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">Ballaststoffe</Text>
                    <Text className="text-sm text-white">{Math.round(grandTotal.fiber)} g</Text>
                  </View>
                )}
                {visibleNutrients.sugar && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">Zucker</Text>
                    <Text className="text-sm text-white">{Math.round(grandTotal.sugar)} g</Text>
                  </View>
                )}
                {visibleNutrients.iron && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">Eisen</Text>
                    <Text className="text-sm text-white">{grandTotal.iron.toFixed(1)} mg</Text>
                  </View>
                )}
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
