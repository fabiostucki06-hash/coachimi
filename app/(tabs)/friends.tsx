import { router, useFocusEffect } from 'expo-router';
import { Check, Dumbbell, Inbox, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendActivityCard } from '@/components/features/FriendActivityCard';
import { FriendProfileModal } from '@/components/features/FriendProfileModal';
import { MEAL_TYPE_META } from '@/components/features/mealMeta';
import { formatNutrientAmount, NUTRIENT_META, NUTRIENT_ORDER, sumEntryNutrients } from '@/components/features/nutrientMeta';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { addMealAndSync, addMealsAndSync } from '@/services/diaryActions';
import {
  fetchFriendActivity,
  fetchFriendships,
  formatFriendLabel,
  removeFriendship,
  respondToRequest,
  searchUsers,
  sendFriendRequest,
  setProfilePublic,
  type FriendActivitySummary,
  type FriendListItem,
  type FriendProfile,
} from '@/services/friends';
import { fetchInboxMealGroupShares, removeMealGroupShare, type MealGroupShare } from '@/services/mealGroupShares';
import { fetchInboxMealShares, removeMealShare, type MealShare } from '@/services/mealShares';
import { fetchInboxWorkoutPlanShares, removeWorkoutPlanShare, type WorkoutPlanShare } from '@/services/workoutPlanShares';
import { useProfileStore } from '@/store/profileStore';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useUserStore } from '@/store/userStore';
import type { FoodItem, MealType, NutrientVisibility } from '@/types';
import { getLocalDateKey } from '@/utils/calendarDates';

function SignedOutPrompt() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Users color="#A1A1AA" size={40} />
        <Text className="text-center text-lg font-semibold text-foreground">Freunde brauchen ein Konto</Text>
        <Text className="text-center text-sm text-text-secondary">
          Melde dich an, um Freunde zu suchen, Anfragen zu verwalten und ihren Fortschritt zu sehen.
        </Text>
        <Button label="Anmelden" onPress={() => router.push('/onboarding')} />
      </View>
    </SafeAreaView>
  );
}

/**
 * Top-of-screen glance at the caller's own handle - read-only here on purpose.
 * @username can only be changed on the Profil screen (components/features/
 * UsernameEditor.tsx lives there now); this is a styled badge, not an input,
 * and the no-username state is a link out rather than an inline editor.
 */
function SelfUsernameHeader({ profile }: { profile: FriendProfile | null }) {
  if (profile?.username) {
    return (
      <View className="flex-row items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
        <Text className="text-sm font-semibold text-primary">Dein Nutzername: @{profile.username}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push('/profil')}
      className="flex-row items-center justify-between rounded-2xl bg-amber-500/10 px-4 py-3 active:opacity-80"
    >
      <Text className="flex-1 pr-3 text-sm text-amber-400">Du hast noch keinen @username.</Text>
      <Text className="text-sm font-semibold text-amber-400">Username im Profil festlegen -&gt;</Text>
    </Pressable>
  );
}

function ProfileSettingsCard({ myId, profile }: { myId: string; profile: FriendProfile | null }) {
  const showToast = useToastStore((state) => state.show);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const [isPublic, setIsPublic] = useState(profile?.isProfilePublic ?? true);

  useEffect(() => {
    setIsPublic(profile?.isProfilePublic ?? true);
  }, [profile?.isProfilePublic]);

  async function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    try {
      await setProfilePublic(myId, next);
      updateProfile({ isProfilePublic: next });
    } catch (err) {
      setIsPublic(!next);
      showToast(err instanceof Error ? err.message : 'Einstellung konnte nicht gespeichert werden');
    }
  }

  return (
    <Card className="gap-3">
      <Text className="text-sm font-semibold text-text-secondary">Dein Profil</Text>
      <Pressable onPress={handleTogglePublic} className="flex-row items-center justify-between rounded-2xl bg-overlay/5 px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-medium text-foreground">Profil öffentlich</Text>
          <Text className="text-xs text-text-secondary">Andere können dich per @username finden und dir eine Anfrage senden.</Text>
        </View>
        <View className={`h-7 w-12 justify-center rounded-full px-0.5 ${isPublic ? 'items-end bg-primary' : 'items-start bg-overlay/10'}`}>
          <View className="h-6 w-6 rounded-full bg-white" />
        </View>
      </Pressable>
    </Card>
  );
}

function SearchResultRow({ profile, onSend, sent }: { profile: FriendProfile; onSend: () => void; sent: boolean }) {
  const [sending, setSending] = useState(false);

  async function handlePress() {
    if (sending || sent) return;
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  }

  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{formatFriendLabel(profile)}</Text>
      </View>
      <Pressable
        onPress={handlePress}
        disabled={sending || sent}
        className={`h-9 w-9 items-center justify-center rounded-full ${sent ? 'bg-overlay/5' : 'bg-primary/10'}`}
      >
        {sending ? <ActivityIndicator size="small" color="#6366F1" /> : sent ? <Check color="#A1A1AA" size={16} /> : <UserPlus color="#6366F1" size={16} />}
      </Pressable>
    </View>
  );
}

interface SharedMealItem {
  foodItem: FoodItem;
  servings: number;
}

/**
 * One entry in the "Geteilte Mahlzeiten" inbox, reviewed here before it ever
 * touches the caller's own diary - either a single food a friend sent
 * (services/mealShares.ts) or a WHOLE meal section bundled as one unit
 * (services/mealGroupShares.ts); both arrive here as a list of items.
 *
 * The nutrient line is filtered to what the RECIPIENT tracks: the viewer of
 * this screen is the recipient, so it reads straight from their own
 * `visibleNutrients` (passed in, not re-fetched) rather than whatever the
 * sender had selected - same idea as the sender-side preview in
 * app/meal-detail.tsx's ShareSheet, resolved locally since no second profile
 * is involved. The three macros are listed like any other visible nutrient.
 */
function SharedMealRow({
  items,
  mealType,
  senderLabel,
  visibleNutrients,
  onAdd,
  onDismiss,
}: {
  items: SharedMealItem[];
  mealType: MealType;
  senderLabel: string | null;
  visibleNutrients: NutrientVisibility;
  onAdd: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const { label: mealLabel } = MEAL_TYPE_META[mealType];
  const totals = sumEntryNutrients(items.map((item) => ({ id: '', mealType, loggedAt: '', foodItem: item.foodItem, servings: item.servings })));
  const kcal = Math.round(items.reduce((sum, item) => sum + item.foodItem.caloriesPerServing * item.servings, 0));
  const visibleKeys = NUTRIENT_ORDER.filter((key) => visibleNutrients[key]);
  const details = [senderLabel ? `Von ${senderLabel}` : null, mealLabel, items.length > 1 ? `${items.length} Lebensmittel` : null, `${kcal} kcal`];

  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  }

  return (
    <View className="gap-2 py-2">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {items.map((item) => item.foodItem.name).join(', ')}
          </Text>
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            {details.filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable onPress={handleAdd} disabled={adding} className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            {adding ? <ActivityIndicator size="small" color="#6366F1" /> : <Check color="#6366F1" size={16} />}
          </Pressable>
          <Pressable onPress={onDismiss} disabled={adding} className="h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
            <X color="#ef4444" size={16} />
          </Pressable>
        </View>
      </View>
      {visibleKeys.length > 0 && (
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          {visibleKeys.map((key) => (
            <Text key={key} className="text-[11px] text-text-secondary">
              {NUTRIENT_META[key].label}: {formatNutrientAmount(key, totals[key])}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** One entry in the "Geteilte Trainingspläne" inbox - a workout plan a friend sent (services/workoutPlanShares.ts), reviewed here before it's cloned into the caller's own plan library. */
function WorkoutPlanShareRow({ share, onAdd, onDismiss }: { share: WorkoutPlanShare; onAdd: () => void; onDismiss: () => void }) {
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  }

  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {share.name}
        </Text>
        <Text className="text-xs text-text-secondary">{share.exercises.length} Übungen</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable onPress={handleAdd} disabled={adding} className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          {adding ? <ActivityIndicator size="small" color="#6366F1" /> : <Check color="#6366F1" size={16} />}
        </Pressable>
        <Pressable onPress={onDismiss} disabled={adding} className="h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
          <X color="#ef4444" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function IncomingRequestRow({ item, onRespond }: { item: FriendListItem; onRespond: (accept: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{formatFriendLabel(item.profile)}</Text>
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={() => onRespond(true)} className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Check color="#6366F1" size={16} />
        </Pressable>
        <Pressable onPress={() => onRespond(false)} className="h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
          <X color="#ef4444" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

export default function FriendsScreen() {
  const session = useSyncStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);

  const myProfile = useProfileStore((state) => state.profile);
  const [friendships, setFriendships] = useState<FriendListItem[]>([]);
  const [activityByFriendId, setActivityByFriendId] = useState<Record<string, FriendActivitySummary>>({});
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const [viewedFriend, setViewedFriend] = useState<FriendProfile | null>(null);

  const [inbox, setInbox] = useState<MealShare[]>([]);
  const [groupInbox, setGroupInbox] = useState<MealGroupShare[]>([]);
  const [planInbox, setPlanInbox] = useState<WorkoutPlanShare[]>([]);
  const addTemplate = useTrainingStore((state) => state.addTemplate);
  const visibleNutrients = useUserStore((state) => state.user.visibleNutrients);

  const myId = session?.user.id;

  const loadFriends = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    try {
      const items = await fetchFriendships(myId);
      setFriendships(items);

      const acceptedIds = items.filter((item) => item.status === 'accepted').map((item) => item.profile.id);
      if (acceptedIds.length > 0) {
        const activity = await fetchFriendActivity(acceptedIds, getLocalDateKey());
        setActivityByFriendId(Object.fromEntries(activity.map((entry) => [entry.friendId, entry])));
      } else {
        setActivityByFriendId({});
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Freunde konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [myId, showToast]);

  const loadInbox = useCallback(async () => {
    if (!myId) return;
    try {
      setInbox(await fetchInboxMealShares(myId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geteilte Mahlzeiten konnten nicht geladen werden');
    }
  }, [myId, showToast]);

  const loadGroupInbox = useCallback(async () => {
    if (!myId) return;
    try {
      setGroupInbox(await fetchInboxMealGroupShares(myId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geteilte Mahlzeiten konnten nicht geladen werden');
    }
  }, [myId, showToast]);

  const loadPlanInbox = useCallback(async () => {
    if (!myId) return;
    try {
      setPlanInbox(await fetchInboxWorkoutPlanShares(myId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geteilte Trainingspläne konnten nicht geladen werden');
    }
  }, [myId, showToast]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Tab screens stay mounted, so a mount-only load would never show a meal a
  // friend sent after the app was opened - the inboxes reload every time this
  // tab comes back into focus instead.
  useFocusEffect(
    useCallback(() => {
      loadInbox();
      loadGroupInbox();
      loadPlanInbox();
    }, [loadInbox, loadGroupInbox, loadPlanInbox]),
  );

  if (!session || !myId) return <SignedOutPrompt />;

  /**
   * Logs a shared meal, then clears it from the inbox - two separate steps on
   * purpose. Once the diary write has succeeded the row leaves the list no
   * matter what: if only the inbox cleanup fails, reporting the whole thing
   * as "Hinzufügen fehlgeschlagen" would invite a second tap and a duplicate
   * diary entry.
   */
  async function addSharedToDiary(addToDiary: () => Promise<void>, clearFromInbox: () => Promise<void>, dropFromList: () => void) {
    try {
      await addToDiary();
    } catch {
      // The diary layer already showed its own failure toast.
      return;
    }
    dropFromList();
    try {
      await clearFromInbox();
      showToast('Zum Tagebuch hinzugefügt', 'success');
    } catch {
      showToast('Hinzugefügt - konnte aber nicht aus dem Posteingang entfernt werden. Bitte dort verwerfen, falls es wieder erscheint.');
    }
  }

  function handleAddSharedMeal(share: MealShare) {
    return addSharedToDiary(
      () => addMealAndSync(getLocalDateKey(), share.foodItem, share.mealType, share.servings),
      () => removeMealShare(share.id),
      () => setInbox((current) => current.filter((item) => item.id !== share.id)),
    );
  }

  async function handleDismissSharedMeal(shareId: string) {
    try {
      await removeMealShare(shareId);
      setInbox((current) => current.filter((item) => item.id !== shareId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  }

  function handleAddSharedMealGroup(share: MealGroupShare) {
    return addSharedToDiary(
      () =>
        addMealsAndSync(
          getLocalDateKey(),
          share.items.map((item) => ({ foodItem: item.foodItem, mealType: share.mealType, servings: item.servings })),
        ),
      () => removeMealGroupShare(share.id),
      () => setGroupInbox((current) => current.filter((item) => item.id !== share.id)),
    );
  }

  async function handleDismissSharedMealGroup(shareId: string) {
    try {
      await removeMealGroupShare(shareId);
      setGroupInbox((current) => current.filter((item) => item.id !== shareId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  }

  async function handleAddSharedPlan(share: WorkoutPlanShare) {
    try {
      addTemplate(share.name, share.exercises);
      await removeWorkoutPlanShare(share.id);
      setPlanInbox((current) => current.filter((item) => item.id !== share.id));
      showToast('Zu deinen Trainingsplänen hinzugefügt', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen');
    }
  }

  async function handleDismissSharedPlan(shareId: string) {
    try {
      await removeWorkoutPlanShare(shareId);
      setPlanInbox((current) => current.filter((item) => item.id !== shareId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  }

  async function handleSearch() {
    if (!myId || searchQuery.trim().length === 0) return;
    setSearching(true);
    try {
      setSearchResults(await searchUsers(searchQuery, myId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Suche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(friendId: string) {
    if (!myId) return;
    try {
      await sendFriendRequest(myId, friendId);
      showToast('Anfrage gesendet', 'success');
      loadFriends();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Anfrage konnte nicht gesendet werden');
    }
  }

  async function handleRespond(friendshipId: string, accept: boolean) {
    try {
      await respondToRequest(friendshipId, accept);
      loadFriends();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  }

  async function handleRemove(friendshipId: string) {
    try {
      await removeFriendship(friendshipId);
      loadFriends();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  }

  const incoming = friendships.filter((item) => item.status === 'pending' && item.direction === 'incoming');
  const outgoing = friendships.filter((item) => item.status === 'pending' && item.direction === 'outgoing');
  const accepted = friendships.filter((item) => item.status === 'accepted');
  const existingFriendIds = new Set(friendships.map((item) => item.profile.id));
  const senderLabelById: Record<string, string> = Object.fromEntries(friendships.map((item) => [item.profile.id, formatFriendLabel(item.profile)]));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:px-10 lg:pb-12">
        <Text className="text-3xl font-bold tracking-tight text-foreground">Freunde</Text>

        <SelfUsernameHeader profile={myProfile} />

        <ProfileSettingsCard myId={myId} profile={myProfile} />

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-text-secondary">Freunde finden</Text>
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <TextField
                placeholder="@username"
                autoCapitalize="none"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
              />
            </View>
            <Button label="Suchen" variant="secondary" icon={<Search color="#6366F1" size={16} />} loading={searching} onPress={handleSearch} className="mb-0" />
          </View>
          {searchResults.length > 0 && (
            <View className="gap-1 border-t border-surface-border pt-2">
              {searchResults.map((profile) => (
                <SearchResultRow
                  key={profile.id}
                  profile={profile}
                  sent={existingFriendIds.has(profile.id)}
                  onSend={() => handleSendRequest(profile.id)}
                />
              ))}
            </View>
          )}
        </Card>

        {(inbox.length > 0 || groupInbox.length > 0) && (
          <Card className="gap-1">
            <View className="flex-row items-center gap-2">
              <Inbox color="#6366F1" size={16} />
              <Text className="text-sm font-semibold text-text-secondary">Geteilte Mahlzeiten</Text>
            </View>
            {groupInbox.map((share) => (
              <SharedMealRow
                key={share.id}
                items={share.items}
                mealType={share.mealType}
                senderLabel={senderLabelById[share.fromUserId] ?? null}
                visibleNutrients={visibleNutrients}
                onAdd={() => handleAddSharedMealGroup(share)}
                onDismiss={() => handleDismissSharedMealGroup(share.id)}
              />
            ))}
            {inbox.map((share) => (
              <SharedMealRow
                key={share.id}
                items={[share]}
                mealType={share.mealType}
                senderLabel={senderLabelById[share.fromUserId] ?? null}
                visibleNutrients={visibleNutrients}
                onAdd={() => handleAddSharedMeal(share)}
                onDismiss={() => handleDismissSharedMeal(share.id)}
              />
            ))}
          </Card>
        )}

        {planInbox.length > 0 && (
          <Card className="gap-1">
            <View className="flex-row items-center gap-2">
              <Dumbbell color="#6366F1" size={16} />
              <Text className="text-sm font-semibold text-text-secondary">Geteilte Trainingspläne</Text>
            </View>
            {planInbox.map((share) => (
              <WorkoutPlanShareRow
                key={share.id}
                share={share}
                onAdd={() => handleAddSharedPlan(share)}
                onDismiss={() => handleDismissSharedPlan(share.id)}
              />
            ))}
          </Card>
        )}

        {incoming.length > 0 && (
          <Card className="gap-1">
            <Text className="text-sm font-semibold text-text-secondary">Anfragen</Text>
            {incoming.map((item) => (
              <IncomingRequestRow key={item.friendshipId} item={item} onRespond={(accept) => handleRespond(item.friendshipId, accept)} />
            ))}
          </Card>
        )}

        {outgoing.length > 0 && (
          <Card className="gap-1">
            <Text className="text-sm font-semibold text-text-secondary">Ausstehend</Text>
            {outgoing.map((item) => (
              <View key={item.friendshipId} className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-text-secondary">{formatFriendLabel(item.profile)}</Text>
                <Pressable onPress={() => handleRemove(item.friendshipId)}>
                  <Text className="text-xs font-semibold text-red-500">Zurückziehen</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        <View className="gap-3">
          <Text className="text-sm font-semibold text-text-secondary">Aktivität deiner Freunde</Text>
          {loading ? (
            <ActivityIndicator color="#6366F1" />
          ) : accepted.length === 0 ? (
            <Text className="text-sm text-text-secondary">Noch keine Freunde - suche oben nach jemandem.</Text>
          ) : (
            accepted.map((item) => (
              <Pressable key={item.friendshipId} onPress={() => setViewedFriend(item.profile)}>
                <FriendActivityCard profile={item.profile} activity={activityByFriendId[item.profile.id]} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <FriendProfileModal friend={viewedFriend} onClose={() => setViewedFriend(null)} />
    </SafeAreaView>
  );
}
