import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { TextField } from '@/components/ui/TextField';
import { useSyncStore } from '@/store/syncStore';
import { useUserStore } from '@/store/userStore';
import { getLastUpdatedLabel } from '@/utils/lastUpdated';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthMode = 'signUp' | 'login';

export default function OnboardingScreen() {
  const updateAccount = useUserStore((state) => state.updateAccount);
  const signUp = useSyncStore((state) => state.signUp);
  const signIn = useSyncStore((state) => state.signIn);

  const [mode, setMode] = useState<AuthMode>('signUp');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
  const isAccountValid =
    mode === 'signUp' ? trimmedName.length > 0 && isEmailValid && password.length >= 6 : isEmailValid && password.length >= 6;

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormError(null);
  }

  async function handleAccountSubmit() {
    if (!isAccountValid || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (mode === 'login') {
        await signIn(trimmedEmail, password);
        router.replace(useUserStore.getState().hasOnboarded ? '/(tabs)' : '/setup');
        return;
      }

      // No "check your email and confirm first" gate - registration goes straight
      // into the app. See store/syncStore.ts's signUp for what happens if the
      // Supabase project still has email confirmation enabled server-side.
      await signUp(trimmedEmail, password);
      // Persist the name right away — /setup only asks for body/goal data, so
      // this is the only place the name is ever captured for a fresh signup.
      updateAccount({ name: trimmedName, email: trimmedEmail });
      router.replace('/setup');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-8" keyboardShouldPersistTaps="handled">
          <Logo size="lg" direction="column" />

          <Card className="gap-4">
            <View className="items-center gap-1">
              <Text className="text-2xl font-bold tracking-tight text-foreground">
                {mode === 'signUp' ? 'Konto erstellen' : 'Willkommen zurück bei Coach imi'}
              </Text>
              <Text className="text-center text-sm text-text-secondary">
                {mode === 'signUp'
                  ? 'Erstelle ein Konto, damit dein Fortschritt in der Cloud gespeichert wird.'
                  : 'Melde dich mit deinem bestehenden Konto an.'}
              </Text>
            </View>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => selectMode('signUp')}
                className={`flex-1 items-center rounded-full border px-4 py-2 transition-colors duration-150 ease-in-out active:opacity-80 ${
                  mode === 'signUp' ? 'border-primary/60 bg-primary/10' : 'border-surface-border bg-overlay/5'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${mode === 'signUp' ? 'text-primary' : 'text-text-secondary'}`}
                >
                  Registrieren
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectMode('login')}
                className={`flex-1 items-center rounded-full border px-4 py-2 transition-colors duration-150 ease-in-out active:opacity-80 ${
                  mode === 'login' ? 'border-primary/60 bg-primary/10' : 'border-surface-border bg-overlay/5'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${mode === 'login' ? 'text-primary' : 'text-text-secondary'}`}
                >
                  Anmelden
                </Text>
              </Pressable>
            </View>

            {mode === 'signUp' && (
              <TextField label="Name" placeholder="Max Mustermann" value={name} onChangeText={setName} autoCapitalize="words" />
            )}
            <TextField
              label="E-Mail-Adresse"
              placeholder="max@beispiel.de"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextField label="Passwort" placeholder="Mind. 6 Zeichen" value={password} onChangeText={setPassword} secureTextEntry />

            {formError && <Text className="text-xs text-red-500">{formError}</Text>}

            <Text className="text-center text-[10px] text-text-secondary">
              Zuletzt aktualisiert: {getLastUpdatedLabel()} Uhr
            </Text>
          </Card>

          <Button
            label={mode === 'signUp' ? 'Konto erstellen' : 'Anmelden'}
            onPress={handleAccountSubmit}
            disabled={!isAccountValid || submitting}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
