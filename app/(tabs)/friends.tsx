import { router } from 'expo-router';
import { Check, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendActivityCard } from '@/components/features/FriendActivityCard';
import { UsernameEditor } from '@/components/features/UsernameEditor';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
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
import { useProfileStore } from '@/store/profileStore';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { getLocalDateKey } from '@/utils/calendarDates';

function SignedOutPrompt() {
  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Users color="#94a3b8" size={40} />
        <Text className="text-center text-lg font-semibold text-slate-900 dark:text-white">Freunde brauchen ein Konto</Text>
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
          Melde dich an, um Freunde zu suchen, Anfragen zu verwalten und ihren Fortschritt zu sehen.
        </Text>
        <Button label="Anmelden" onPress={() => router.push('/onboarding')} />
      </View>
    </SafeAreaView>
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
      <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Dein Profil</Text>
      {profile?.username && (
        <View className="rounded-2xl bg-emerald-500/10 px-4 py-3">
          <Text className="text-xs text-emerald-600 dark:text-emerald-400">Dein Handle - teile ihn mit Freunden</Text>
          <Text className="text-lg font-bold text-emerald-600 dark:text-emerald-400">@{profile.username}</Text>
        </View>
      )}
      <UsernameEditor myId={myId} />
      <Pressable onPress={handleTogglePublic} className="flex-row items-center justify-between rounded-2xl bg-slate-100/70 px-4 py-3 dark:bg-white/5">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-200">Profil öffentlich</Text>
          <Text className="text-xs text-slate-400">Andere können dich per @username finden und dir eine Anfrage senden.</Text>
        </View>
        <View className={`h-7 w-12 justify-center rounded-full px-0.5 ${isPublic ? 'items-end bg-emerald-500' : 'items-start bg-slate-300 dark:bg-slate-700'}`}>
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
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">{formatFriendLabel(profile)}</Text>
      </View>
      <Pressable
        onPress={handlePress}
        disabled={sending || sent}
        className={`h-9 w-9 items-center justify-center rounded-full ${sent ? 'bg-slate-100 dark:bg-white/5' : 'bg-emerald-500/10'}`}
      >
        {sending ? <ActivityIndicator size="small" color="#10b981" /> : sent ? <Check color="#94a3b8" size={16} /> : <UserPlus color="#10b981" size={16} />}
      </Pressable>
    </View>
  );
}

function IncomingRequestRow({ item, onRespond }: { item: FriendListItem; onRespond: (accept: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">{formatFriendLabel(item.profile)}</Text>
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={() => onRespond(true)} className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
          <Check color="#10b981" size={16} />
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

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  if (!session || !myId) return <SignedOutPrompt />;

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

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:px-10 lg:pb-12">
        <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Freunde</Text>

        <ProfileSettingsCard myId={myId} profile={myProfile} />

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Freunde finden</Text>
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
            <Button label="Suchen" variant="secondary" icon={<Search color="#10b981" size={16} />} loading={searching} onPress={handleSearch} className="mb-0" />
          </View>
          {searchResults.length > 0 && (
            <View className="gap-1 border-t border-slate-100 pt-2 dark:border-white/5">
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

        {incoming.length > 0 && (
          <Card className="gap-1">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Anfragen</Text>
            {incoming.map((item) => (
              <IncomingRequestRow key={item.friendshipId} item={item} onRespond={(accept) => handleRespond(item.friendshipId, accept)} />
            ))}
          </Card>
        )}

        {outgoing.length > 0 && (
          <Card className="gap-1">
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ausstehend</Text>
            {outgoing.map((item) => (
              <View key={item.friendshipId} className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-slate-600 dark:text-slate-300">{formatFriendLabel(item.profile)}</Text>
                <Pressable onPress={() => handleRemove(item.friendshipId)}>
                  <Text className="text-xs font-semibold text-red-500">Zurückziehen</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        <View className="gap-3">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Aktivität deiner Freunde</Text>
          {loading ? (
            <ActivityIndicator color="#10b981" />
          ) : accepted.length === 0 ? (
            <Text className="text-sm text-slate-400">Noch keine Freunde - suche oben nach jemandem.</Text>
          ) : (
            accepted.map((item) => (
              <FriendActivityCard key={item.friendshipId} profile={item.profile} activity={activityByFriendId[item.profile.id]} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
