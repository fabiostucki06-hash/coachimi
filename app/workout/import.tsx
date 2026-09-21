import { router, useLocalSearchParams } from 'expo-router';
import { Dumbbell, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeWorkoutPlan, extractShareCode, WorkoutShareError, type SharedWorkoutPlan } from '@/services/workoutShare';
import { useToastStore } from '@/store/toastStore';
import { useTrainingStore } from '@/store/trainingStore';

function decodeParam(code: string | string[] | undefined): { plan: SharedWorkoutPlan | null; error: string | null } {
  const raw = Array.isArray(code) ? code[0] : code;
  if (!raw) return { plan: null, error: 'Kein Code gefunden. Öffne den geteilten Link erneut.' };
  try {
    return { plan: decodeWorkoutPlan(extractShareCode(raw)), error: null };
  } catch (err) {
    return { plan: null, error: err instanceof WorkoutShareError ? err.message : 'Der Plan konnte nicht gelesen werden.' };
  }
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Receiving end of a shared workout plan (`/workout/import?code=...`): previews the decoded plan and clones it into the local plan library on confirm. */
export default function ImportWorkoutScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const addTemplate = useTrainingStore((state) => state.addTemplate);
  const { plan, error } = useMemo(() => decodeParam(params.code), [params.code]);
  const [imported, setImported] = useState(false);

  function handleImport() {
    if (!plan || imported) return;
    setImported(true);
    addTemplate(plan.name, plan.exercises);
    useToastStore.getState().show(`„${plan.name}“ zu deinen Trainingsplänen hinzugefügt.`, 'success');
    router.replace('/training-templates');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-foreground">Plan importieren</Text>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 active:scale-95 active:opacity-80"
          onPress={close}
          accessibilityLabel="Schließen"
        >
          <X color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pt-4 pb-12">
        {plan ? (
          <>
            <Card className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Dumbbell color="#6366F1" size={18} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{plan.name}</Text>
                  <Text className="text-xs text-text-secondary">{plan.exercises.length} Übungen</Text>
                </View>
              </View>

              {plan.exercises.map((exercise, index) => (
                <View key={index} className="flex-row items-center justify-between gap-3 border-t border-surface-border pt-3">
                  <Text className="flex-1 text-sm text-foreground">{exercise.name}</Text>
                  <Text className="text-xs text-text-secondary">
                    {exercise.targetSets} × {exercise.targetRepsMin}-{exercise.targetRepsMax} Wdh.
                  </Text>
                </View>
              ))}
            </Card>

            <Button label="Zu meinen Plänen hinzufügen" icon={<Plus color="#ffffff" size={18} />} onPress={handleImport} disabled={imported} />
            <Button label="Abbrechen" variant="secondary" onPress={close} />
          </>
        ) : (
          <>
            <Card>
              <Text className="text-center text-sm text-red-400">{error}</Text>
            </Card>
            <Button label="Schließen" variant="secondary" onPress={close} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
