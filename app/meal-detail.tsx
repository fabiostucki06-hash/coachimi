import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Copy, Plus, Send, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MEAL_TYPES } from '@/components/features/mealMeta';
import { NUTRIENT_META, NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { copyEntryAndSync, copyMealAndSync, removeMealAndSync } from '@/services/diaryActions';
import { fetchFriendships, fetchFriendSnapshot, formatFriendLabel, type FriendListItem } from '@/services/friends';
import { shareMealGroupWithFriend } from '@/services/mealGroupShares';
import { shareMealWithFriend } from '@/services/mealShares';
import { useDiaryStore } from '@/store/diaryStore';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { MealEntry, MealType, NutrientKey, NutrientVisibility } from '@/types';
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

function NutrientStat({ nutrientKey, value, subLabel }: { nutrientKey: NutrientKey; value: number; subLabel?: string }) {
  const { label, unit, color, Icon } = NUTRIENT_META[nutrientKey];
  return (
    <View className="basis-[30%] items-center gap-1 rounded-2xl bg-overlay/5 py-3 ">
      <Icon color={color} size={16} />
      <Text className="text-sm font-bold text-foreground">
        {Math.round(value)}
        {unit}
      </Text>
      <Text className="text-[10px] text-text-secondary" numberOfLines={1}>
        {label}
      </Text>
      {subLabel && (
        <Text className="text-[9px] text-text-secondary/70" numberOfLines={1}>
          {subLabel}
        </Text>
      )}
    </View>
  );
}

/**
 * Friend picker + recipient-aware preview for "Send Meal to Friend" - only
 * shows accepted friends, since sending is DB-gated on an accepted
 * friendship anyway (supabase/migrations/0002_meal_shares.sql and
 * 0012_meal_group_shares.sql). Tapping a friend doesn't send immediately:
 * it fetches that friend's own synced profile (services/friends.ts's
 * fetchFriendSnapshot, same read FriendProfileModal already relies on) so
 * the preview can show the shared nutrients filtered to THEIR
 * visibleNutrients selection, not the sender's own - "respecting their
 * profile-selected macros" rather than assuming the sender's view applies.
 * Falls back to the plain macros (always meaningful regardless of profile
 * settings) if the friend has no synced snapshot yet or the fetch fails.
 */
function ShareSheet({
  entries,
  friends,
  loading,
  onConfirm,
  onClose,
}: {
  entries: MealEntry[];
  friends: FriendListItem[];
  loading: boolean;
  onConfirm: (friendId: string) => void;
  onClose: () => void;
}) {
  const [previewFriend, setPreviewFriend] = useState<FriendListItem | null>(null);
  const [recipientVisible, setRecipientVisible] = useState<NutrientVisibility | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const totals = sumEntryNutrients(entries);
  const kcal = Math.round(entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0));
  const title = entries.length === 1 ? `"${entries[0].foodItem.name}"` : `${entries.length} Lebensmittel`;

  async function handlePickFriend(friend: FriendListItem) {
    setPreviewFriend(friend);
    setLoadingPreview(true);
    try {
      const snapshot = await fetchFriendSnapshot(friend.profile.id);
      setRecipientVisible(snapshot?.user?.visibleNutrients ?? null);
    } catch {
      setRecipientVisible(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  if (previewFriend) {
    // visibleNutrients is a profile setting, not every key explicitly set - an
    // unset key reads as "not selected", so a friend with no synced profile at
    // all (recipientVisible === null) still sees the three core macros rather
    // than an empty preview.
    const visibleKeys = recipientVisible
      ? NUTRIENT_ORDER.filter((key) => recipientVisible[key])
      : (['carbs', 'protein', 'fat'] as NutrientKey[]);

    return (
      <Card className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-3 text-sm font-semibold text-text-secondary" numberOfLines={1}>
            An {formatFriendLabel(previewFriend.profile)} senden
          </Text>
          <Pressable onPress={onClose}>
            <X color="#A1A1AA" size={16} />
          </Pressable>
        </View>
        <Text className="text-sm text-foreground">
          {title} · {kcal} kcal
        </Text>
        {loadingPreview ? (
          <ActivityIndicator color="#6366F1" />
        ) : (
          <View className="gap-1 rounded-2xl bg-overlay/5 p-3">
            <Text className="text-xs font-semibold text-text-secondary">
              {recipientVisible ? 'Zeigt die Nährwerte, die diese Person verfolgt:' : 'Keine Profildaten gefunden - zeigt nur die Makros:'}
            </Text>
            <View className="flex-row flex-wrap gap-2 pt-1">
              {visibleKeys.map((key) => (
                <Text key={key} className="text-xs text-foreground">
                  {NUTRIENT_META[key].label}: {Math.round(totals[key])}
                  {NUTRIENT_META[key].unit}
                </Text>
              ))}
            </View>
          </View>
        )}
        <View className="flex-row gap-3">
          <Button label="Zurück" variant="secondary" onPress={() => setPreviewFriend(null)} className="flex-1" />
          <Button label="Senden" icon={<Send color="#ffffff" size={16} />} onPress={() => onConfirm(previewFriend.profile.id)} className="flex-1" />
        </View>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm font-semibold text-text-secondary" numberOfLines={1}>
          {title} an Freund senden
        </Text>
        <Pressable onPress={onClose}>
          <X color="#A1A1AA" size={16} />
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color="#6366F1" />
      ) : friends.length === 0 ? (
        <Text className="py-2 text-sm text-text-secondary">Noch keine Freunde - füge zuerst welche im Freunde-Tab hinzu.</Text>
      ) : (
        <View className="gap-1">
          {friends.map((friend) => (
            <Pressable
              key={friend.friendshipId}
              onPress={() => handlePickFriend(friend)}
              className="flex-row items-center justify-between rounded-2xl bg-overlay/5 px-4 py-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-foreground">{formatFriendLabel(friend.profile)}</Text>
              <Send color="#6366F1" size={16} />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

type CopyTarget = { kind: 'entry'; entryId: string } | { kind: 'meal' };

/** Date + meal-slot picker for "copy entry/meal" - defaults to the same meal slot it was copied from, but letting `toMealType` diverge is what makes this a cross-slot copy (e.g. Frühstück -> Mittagessen) rather than just a cross-date one. */
function CopySheet({
  date,
  mealType,
  targetKind,
  onConfirm,
  onClose,
}: {
  date: string;
  mealType: MealType;
  targetKind: CopyTarget['kind'];
  onConfirm: (toDate: string, toMealType: MealType) => void;
  onClose: () => void;
}) {
  const [toDate, setToDate] = useState(date);
  const [toMealType, setToMealType] = useState<MealType>(mealType);

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
      <View className="flex-row flex-wrap gap-2">
        {MEAL_TYPES.map((candidate) => (
          <Pressable
            key={candidate}
            onPress={() => setToMealType(candidate)}
            className={`rounded-full px-3 py-1.5 ${toMealType === candidate ? 'bg-primary' : 'bg-overlay/5'}`}
          >
            <Text className={`text-xs font-semibold ${toMealType === candidate ? 'text-white' : 'text-text-secondary'}`}>
              {MEAL_LABELS[candidate]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-3">
        <Button label="Abbrechen" variant="secondary" onPress={onClose} className="flex-1" />
        <Button label="Kopieren" icon={<Copy color="#ffffff" size={16} />} onPress={() => onConfirm(toDate, toMealType)} className="flex-1" />
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

  const session = useSyncStore((state) => state.session);
  const myId = session?.user.id;
  const [shareEntries, setShareEntries] = useState<MealEntry[] | null>(null);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const totalKcal = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const nutrientAmounts = sumEntryNutrients(entries);
  const visibleNutrientKeys = NUTRIENT_ORDER.filter((key) => visibleNutrients[key]);

  /** Opens the share sheet for either one entry ([entry]) or the whole meal section (all its entries) - the sheet itself decides single-item vs. group sharing based on the array length. */
  async function handleOpenShare(entriesToShare: MealEntry[]) {
    setShareEntries(entriesToShare);
    if (!myId) return;
    setLoadingFriends(true);
    try {
      const items = await fetchFriendships(myId);
      setFriends(items.filter((item) => item.status === 'accepted'));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : 'Freunde konnten nicht geladen werden');
    } finally {
      setLoadingFriends(false);
    }
  }

  async function handleConfirmShare(friendId: string) {
    const toShare = shareEntries;
    if (!toShare || toShare.length === 0 || !myId) return;
    setShareEntries(null);
    try {
      if (toShare.length === 1) {
        const entry = toShare[0];
        await shareMealWithFriend(myId, friendId, entry.foodItem, entry.mealType, entry.servings);
      } else {
        await shareMealGroupWithFriend(
          myId,
          friendId,
          mealType,
          toShare.map((entry) => ({ foodItem: entry.foodItem, servings: entry.servings })),
        );
      }
      useToastStore.getState().show('Mahlzeit gesendet', 'success');
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    }
  }

  async function handleConfirmCopy(toDate: string, toMealType: MealType) {
    const target = copyTarget;
    if (!target) return;
    setCopyTarget(null);
    try {
      if (target.kind === 'entry') {
        await copyEntryAndSync(date, target.entryId, toDate, toMealType);
      } else {
        await copyMealAndSync(date, mealType, toDate, toMealType);
      }
      const destination = toMealType === mealType ? formatDateShort(toDate) : `${MEAL_LABELS[toMealType]} am ${formatDateShort(toDate)}`;
      useToastStore.getState().show(`Nach ${destination} kopiert.`, 'success');
    } catch {
      // Failure toast already shown inside addMealsAndSync.
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <View>
          <Text className="text-lg font-bold tracking-tight text-foreground">
            {MEAL_LABELS[mealType]}
          </Text>
          <Text className="text-xs text-text-secondary">
            {entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}` : 'Noch keine Einträge'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {entries.length > 0 && myId && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
              onPress={() => handleOpenShare(entries)}
              accessibilityLabel="Ganze Mahlzeit an Freund senden"
            >
              <Send color="#6366F1" size={16} />
            </Pressable>
          )}
          {entries.length > 0 && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
              onPress={() => setCopyTarget({ kind: 'meal' })}
              accessibilityLabel="Ganze Mahlzeit kopieren"
            >
              <Copy color="#A1A1AA" size={16} />
            </Pressable>
          )}
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80  "
            onPress={() => router.back()}
          >
            <X color="#A1A1AA" size={18} />
          </Pressable>
        </View>
      </View>

      {copyTarget && (
        <View className="px-6 pt-4">
          <CopySheet date={date} mealType={mealType} targetKind={copyTarget.kind} onConfirm={handleConfirmCopy} onClose={() => setCopyTarget(null)} />
        </View>
      )}

      {shareEntries && (
        <View className="px-6 pt-4">
          <ShareSheet
            entries={shareEntries}
            friends={friends}
            loading={loadingFriends}
            onConfirm={handleConfirmShare}
            onClose={() => setShareEntries(null)}
          />
        </View>
      )}

      <View className="mx-6 mt-4 gap-3 rounded-[28px] border border-surface-border bg-surface p-4 shadow-md shadow-black/20 backdrop-blur-xl  ">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-secondary">{MEAL_LABELS[mealType]} gesamt</Text>
          <Text className="text-lg font-bold tracking-tight text-foreground">{Math.round(totalKcal)} kcal</Text>
        </View>
        {visibleNutrientKeys.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {visibleNutrientKeys.map((key) => (
              <NutrientStat
                key={key}
                nutrientKey={key}
                value={nutrientAmounts[key]}
                subLabel={key === 'sugar' && nutrientAmounts.fructose > 0 ? `davon Fruchtzucker: ${Math.round(nutrientAmounts.fructose)}g` : undefined}
              />
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
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {entry.foodItem.name}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {formatAmount(entry)} · {Math.round(entry.foodItem.caloriesPerServing * entry.servings)} kcal
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {myId && (
                  <Pressable
                    className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80"
                    onPress={() => handleOpenShare([entry])}
                    accessibilityLabel="An Freund senden"
                  >
                    <Send color="#6366F1" size={14} />
                  </Pressable>
                )}
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
