import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MEAL_TYPES, MEAL_TYPE_META } from '@/components/features/mealMeta';
import { NUTRIENT_META } from '@/components/features/nutrientMeta';
import { fetchFriendSnapshot, formatFriendLabel, type FriendProfile } from '@/services/friends';
import { useToastStore } from '@/store/toastStore';
import type { CloudSnapshot } from '@/services/cloudSync';
import type { MealEntry, MealType, NutrientKey } from '@/types';
import { addDays, getLocalDateKey } from '@/utils/calendarDates';

const ACCENT = '#6366F1';
const CORE_MACROS: NutrientKey[] = ['protein', 'carbs', 'fat'];

interface MealTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function sumMeal(entries: MealEntry[]): MealTotals {
  return entries.reduce(
    (totals, entry) => {
      const { foodItem, servings } = entry;
      return {
        kcal: totals.kcal + foodItem.caloriesPerServing * servings,
        protein: totals.protein + foodItem.macrosPerServing.protein * servings,
        carbs: totals.carbs + foodItem.macrosPerServing.carbs * servings,
        fat: totals.fat + foodItem.macrosPerServing.fat * servings,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function MacroGoalRow({ nutrientKey, amount, goal }: { nutrientKey: NutrientKey; amount: number; goal: number }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  const pct = goal > 0 ? Math.min(Math.round((amount / goal) * 100), 100) : 0;

  return (
    <View className="flex-1 gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Icon color={color} size={13} />
        <Text className="text-xs font-medium text-text-secondary">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-white">
        {Math.round(amount)}
        {unit}
        <Text className="text-xs font-normal text-text-secondary"> /{Math.round(goal)}{unit}</Text>
      </Text>
      <View className="h-1.5 w-full rounded-full bg-white/10">
        <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Same shape as DayDetailModal's meal card, minus every interactive affordance - no add/edit/delete, no quantity or camera/barcode entry points. Purely a list of what the friend logged. */
function MealSection({ mealType, entries }: { mealType: MealType; entries: MealEntry[] }) {
  const { label, Icon } = MEAL_TYPE_META[mealType];
  const totals = useMemo(() => sumMeal(entries), [entries]);

  return (
    <View className="gap-3 rounded-[24px] border border-surface-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Icon color={ACCENT} size={16} />
          </View>
          <Text className="text-sm font-semibold text-white">{label}</Text>
        </View>
        {entries.length > 0 && (
          <Text className="text-xs text-text-secondary">
            {Math.round(totals.kcal)} kcal · {Math.round(totals.protein)}g P · {Math.round(totals.carbs)}g C · {Math.round(totals.fat)}g F
          </Text>
        )}
      </View>

      {entries.length === 0 ? (
        <Text className="text-xs text-text-secondary">Keine Einträge</Text>
      ) : (
        <View className="gap-2 border-t border-surface-border pt-3">
          {entries.map((entry) => (
            <View key={entry.id} className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm text-white" numberOfLines={1}>
                  {entry.foodItem.name}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {entry.servings}× {entry.foodItem.servingSize}{entry.foodItem.servingUnit}
                </Text>
              </View>
              <Text className="text-sm text-text-secondary">{Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface FriendProfileModalProps {
  /** Friend to show, or null to keep the modal closed. */
  friend: FriendProfile | null;
  onClose: () => void;
}

/**
 * Read-only day view of a friend's log - calories/macros vs. their own goals
 * and the same Frühstück/Mittagessen/... breakdown as DayDetailModal, but
 * sourced from their synced snapshot (services/friends.ts fetchFriendSnapshot,
 * gated by the "Accepted friends can read" RLS policy in supabase/schema.sql)
 * instead of the local diaryStore. No edit/delete/add-entry affordance exists
 * anywhere in this component on purpose - it must stay impossible to mutate
 * another user's data from here, not just hidden behind a permission check.
 */
export function FriendProfileModal({ friend, onClose }: FriendProfileModalProps) {
  const showToast = useToastStore((state) => state.show);
  const [snapshot, setSnapshot] = useState<CloudSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateKey, setDateKey] = useState(getLocalDateKey());

  useEffect(() => {
    if (!friend) return;
    setDateKey(getLocalDateKey());
  }, [friend]);

  useEffect(() => {
    if (!friend) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchFriendSnapshot(friend.id)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((err) => {
        if (!cancelled) showToast(err instanceof Error ? err.message : 'Profil konnte nicht geladen werden');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friend, showToast]);

  const entries = snapshot?.entriesByDate?.[dateKey] ?? [];

  const { entriesByMealType, totalCalories, totalMacros } = useMemo(() => {
    const grouped: Record<MealType, MealEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
    for (const entry of entries) {
      grouped[entry.mealType].push(entry);
    }
    const totals = sumMeal(entries);
    return {
      entriesByMealType: grouped,
      totalCalories: totals.kcal,
      totalMacros: { protein: totals.protein, carbs: totals.carbs, fat: totals.fat },
    };
  }, [entries]);

  const calorieGoal = snapshot?.user?.dailyCalorieGoal ?? 0;
  const macroGoal = snapshot?.user?.dailyMacroGoal;
  const isToday = dateKey === getLocalDateKey();

  const dateLabel = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal visible={friend !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-surface/50" onPress={onClose}>
        <Pressable className="max-h-[88%] gap-5 rounded-t-[32px] bg-background px-6 pb-8 pt-5" onPress={(e) => e.stopPropagation()}>
          <View className="items-center">
            <View className="h-1.5 w-10 rounded-full bg-white/20" />
          </View>

          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-3 text-xl font-bold tracking-tight text-white">{friend ? formatFriendLabel(friend) : ''}</Text>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-80"
              onPress={onClose}
              accessibilityLabel="Schliessen"
            >
              <X color="#A1A1AA" size={18} />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-2 rounded-2xl bg-white/5 px-4 py-2.5">
            <Lock color="#A1A1AA" size={14} />
            <Text className="flex-1 text-xs font-medium text-text-secondary">
              Schreibgeschützt – Ansicht von {friend?.username ? `@${friend.username}` : formatFriendLabel(friend ?? { id: '', email: '', username: null, name: null, isProfilePublic: true })}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#6366F1" />
          ) : !snapshot ? (
            <Text className="py-8 text-center text-sm text-text-secondary">Keine geteilten Daten verfügbar.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 pb-4">
              <View className="flex-row items-center justify-between">
                <Pressable
                  accessibilityLabel="Vorheriger Tag"
                  className="h-9 w-9 items-center justify-center rounded-full active:bg-white/5"
                  onPress={() => setDateKey((key) => addDays(key, -1))}
                >
                  <ChevronLeft color="#A1A1AA" size={18} />
                </Pressable>
                <Text className="text-sm font-semibold text-white">{dateLabel}</Text>
                <Pressable
                  accessibilityLabel="Nächster Tag"
                  disabled={isToday}
                  className={`h-9 w-9 items-center justify-center rounded-full active:bg-white/5 ${isToday ? 'opacity-30' : ''}`}
                  onPress={() => setDateKey((key) => addDays(key, 1))}
                >
                  <ChevronRight color="#A1A1AA" size={18} />
                </Pressable>
              </View>

              <View className="gap-4 rounded-[24px] border border-surface-border bg-surface p-4">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-sm font-semibold text-text-secondary">Kalorien</Text>
                  <Text className="text-base font-bold text-white">
                    {Math.round(totalCalories)} <Text className="text-xs font-normal text-text-secondary">/ {calorieGoal} kcal</Text>
                  </Text>
                </View>
                <View className="h-2 w-full rounded-full bg-white/10">
                  <View
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${calorieGoal > 0 ? Math.min(Math.round((totalCalories / calorieGoal) * 100), 100) : 0}%` }}
                  />
                </View>

                {macroGoal && (
                  <View className="flex-row gap-3 border-t border-surface-border pt-4">
                    {CORE_MACROS.map((key) => (
                      <MacroGoalRow key={key} nutrientKey={key} amount={totalMacros[key as keyof typeof totalMacros]} goal={macroGoal[key as keyof typeof macroGoal]} />
                    ))}
                  </View>
                )}
              </View>

              <View className="gap-3">
                {MEAL_TYPES.map((mealType) => (
                  <MealSection key={mealType} mealType={mealType} entries={entriesByMealType[mealType]} />
                ))}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
