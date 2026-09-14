import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  checkUsernameAvailable,
  normalizeUsernameInput,
  updateUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type FriendProfile,
} from '@/services/friends';
import { useToastStore } from '@/store/toastStore';

const CHECK_DEBOUNCE_MS = 400;

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const STATUS_COLOR: Record<Status, string> = {
  idle: 'text-slate-400',
  checking: 'text-slate-400',
  available: 'text-emerald-500',
  taken: 'text-red-500',
  invalid: 'text-red-500',
};

/** Required @username field with live uniqueness checking, reused on the Profil screen and the Freunde tab so both places share one validation/debounce implementation. */
export function UsernameEditor({
  myId,
  profile,
  onUpdated,
}: {
  myId: string;
  profile: FriendProfile | null;
  onUpdated: (profile: FriendProfile) => void;
}) {
  const showToast = useToastStore((state) => state.show);
  const [value, setValue] = useState(profile?.username ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setValue(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value === (profile?.username ?? '')) {
      setStatus('idle');
      return;
    }
    if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(value, myId);
        if (requestIdRef.current !== requestId) return;
        setStatus(available ? 'available' : 'taken');
      } catch {
        if (requestIdRef.current !== requestId) return;
        setStatus('idle');
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, myId, profile?.username]);

  async function handleSave() {
    if (status !== 'available' || saving) return;
    setSaving(true);
    try {
      await updateUsername(myId, value);
      onUpdated(profile ? { ...profile, username: value } : { id: myId, email: '', username: value, name: null, isProfilePublic: true });
      showToast('Username gespeichert', 'success');
      setStatus('idle');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Username konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  const statusText: Record<Status, string> = {
    idle: `${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} Zeichen, klein geschrieben, a-z 0-9 _`,
    checking: 'Prüfe Verfügbarkeit...',
    available: `@${value} ist verfügbar`,
    taken: `@${value} ist bereits vergeben`,
    invalid: `Username muss ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} Zeichen lang sein`,
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <TextField
            label="Username"
            placeholder="dein_username"
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            onChangeText={(text) => setValue(normalizeUsernameInput(text))}
          />
        </View>
        <Button label="Speichern" variant="secondary" loading={saving} disabled={status !== 'available'} onPress={handleSave} className="mb-0" />
      </View>
      <Text className={`text-xs ${STATUS_COLOR[status]}`}>{statusText[status]}</Text>
    </View>
  );
}
