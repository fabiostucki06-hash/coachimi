import { ChevronRight, Dumbbell, Minus, Plus, Sparkles, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DateSelector } from '@/components/features/DateSelector';
import { TrainingScienceTips } from '@/components/features/TrainingScienceTips';
import { TrainingSyncBanner } from '@/components/features/TrainingSyncBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTrainingStore, getSessionsForExercise } from '@/store/trainingStore';
import { useUiStore } from '@/store/uiStore';
import type { LoggedExercise, WorkoutSession } from '@/types';
import { compareToPrevious, generateProgressionTip, getLastPerformance } from '@/utils/trainingProgression';

/** Stable reference for the "no sessions" case - an inline `[]` fallback in a zustand selector returns a new array every read, which trips React's getSnapshot-must-be-cached check and causes an infinite render loop (error #185). */
const EMPTY_SESSIONS: WorkoutSession[] = [];

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Keeps its own text state instead of deriving `value` from `weightKg` on every render.
 * A controlled input bound directly to `String(weightKg)` re-parses on each keystroke and
 * snaps back to the number's string form, which strips a trailing "." or "," before the
 * user can type the fraction digit - decimals could never be entered.
 */
function WeightInput({ weightKg, onChange }: { weightKg: number; onChange: (weightKg: number) => void }) {
  const [text, setText] = useState(weightKg ? String(weightKg) : '');

  return (
    <TextInput
      className="flex-1 rounded-xl border border-surface-border bg-overlay/5 px-3 py-2 text-sm text-foreground"
      keyboardType="decimal-pad"
      value={text}
      placeholder="kg"
      placeholderTextColor="#A1A1AA"
      onChangeText={(value) => {
        setText(value);
        onChange(parseNumber(value, 0));
      }}
    />
  );
}

function DeltaBadge({ label, pct }: { label: string; pct: number | null }) {
  if (pct === null) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-overlay/5 px-2.5 py-1">
        <Text className="text-[11px] font-medium text-text-secondary">{label}: neu</Text>
      </View>
    );
  }

  const rounded = Math.round(pct * 10) / 10;
  const isUp = rounded > 0.05;
  const isDown = rounded < -0.05;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = isUp ? '#10b981' : isDown ? '#ef4444' : '#A1A1AA';
  const bg = isUp ? 'bg-emerald-500/10' : isDown ? 'bg-red-500/10' : 'bg-overlay/5';

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${bg}`}>
      <Icon color={color} size={12} />
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}: {rounded > 0 ? '+' : ''}{rounded}%
      </Text>
    </View>
  );
}

function ExerciseRow({ session, exercise }: { session: WorkoutSession; exercise: LoggedExercise }) {
  const addSet = useTrainingStore((state) => state.addSet);
  const updateSet = useTrainingStore((state) => state.updateSet);
  const removeSet = useTrainingStore((state) => state.removeSet);

  const history = getSessionsForExercise(exercise.name, session.date).map((entry) => entry.exercise);
  const comparison = compareToPrevious(exercise, history[0] ?? null);
  const tip = generateProgressionTip(exercise, history);
  const lastPerformance = getLastPerformance(history[0] ?? null);
  // Set-by-set numbers from the previous session, so each row shows what to beat right where it's typed.
  const previousSets = (history[0]?.sets ?? []).filter((previousSet) => previousSet.reps > 0);

  return (
    <View className="gap-3 border-t border-surface-border pt-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">{exercise.name}</Text>
        <Text className="text-[11px] text-text-secondary">
          Ziel: {exercise.targetRepsMin}-{exercise.targetRepsMax} Wdh.
        </Text>
      </View>

      {lastPerformance && (
        <Text className="text-[11px] font-semibold text-foreground">
          Letztes Mal: {lastPerformance.weightKg} kg × {lastPerformance.reps} Wdh.
        </Text>
      )}

      <View className="flex-row flex-wrap gap-2">
        <DeltaBadge label="Volumen" pct={comparison.volumePct} />
        <DeltaBadge label="Kraft" pct={comparison.strengthPct} />
      </View>

      <View className="gap-2">
        {(exercise.sets ?? []).map((set, index) => {
          const previousSet = previousSets[index];
          return (
            <View key={index} className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="w-5 text-xs text-text-secondary">{index + 1}</Text>
                <WeightInput
                  weightKg={set.weightKg}
                  onChange={(weightKg) => updateSet(session.date, session.id, exercise.id, index, { weightKg })}
                />
                <TextInput
                  className="flex-1 rounded-xl border border-surface-border bg-overlay/5 px-3 py-2 text-sm text-foreground"
                  keyboardType="number-pad"
                  value={set.reps ? String(set.reps) : ''}
                  placeholder="Wdh."
                  placeholderTextColor="#A1A1AA"
                  onChangeText={(text) => updateSet(session.date, session.id, exercise.id, index, { reps: Math.round(parseNumber(text, 0)) })}
                />
                <Pressable
                  className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80"
                  onPress={() => removeSet(session.date, session.id, exercise.id, index)}
                >
                  <X color="#ef4444" size={12} />
                </Pressable>
              </View>
              {previousSet && (
                <Text className="pl-7 text-[11px] font-semibold text-primary">
                  Letztes Mal: {previousSet.weightKg} kg × {previousSet.reps} Wdh.
                </Text>
              )}
            </View>
          );
        })}
        <Pressable
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-border py-2 active:opacity-70"
          onPress={() => addSet(session.date, session.id, exercise.id)}
        >
          <Plus color="#6366F1" size={14} />
          <Text className="text-xs font-medium text-primary">Satz hinzufügen</Text>
        </Pressable>
      </View>

      <View className="flex-row items-start gap-2 rounded-xl bg-primary/5 p-2.5">
        <Sparkles color="#6366F1" size={14} />
        <Text className="flex-1 text-[11px] leading-4 text-primary">{tip}</Text>
      </View>
    </View>
  );
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const removeSession = useTrainingStore((state) => state.removeSession);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Dumbbell color="#6366F1" size={16} />
          </View>
          <Text className="text-sm font-semibold text-foreground">{session.templateName}</Text>
        </View>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-overlay/5 active:opacity-80"
          onPress={() => removeSession(session.date, session.id)}
        >
          <Trash2 color="#A1A1AA" size={14} />
        </Pressable>
      </View>

      {(session.exercises ?? []).map((exercise) => (
        <ExerciseRow key={exercise.id} session={session} exercise={exercise} />
      ))}
    </Card>
  );
}

function AttachTemplateSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const templates = useTrainingStore((state) => state.templates);
  const attachTemplateToDate = useTrainingStore((state) => state.attachTemplateToDate);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-secondary">Vorlage anhängen</Text>
        <Pressable onPress={onClose}>
          <X color="#A1A1AA" size={16} />
        </Pressable>
      </View>
      {(templates ?? []).length === 0 ? (
        <Text className="text-sm text-text-secondary">Noch keine Trainingspläne erstellt.</Text>
      ) : (
        (templates ?? []).map((template) => (
          <Pressable
            key={template.id}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface px-4 py-3 active:opacity-80"
            onPress={() => {
              attachTemplateToDate(date, template.id);
              onClose();
            }}
          >
            <View>
              <Text className="text-sm font-semibold text-foreground">{template.name}</Text>
              <Text className="text-xs text-text-secondary">{template.exercises.length} Übungen</Text>
            </View>
            <ChevronRight color="#A1A1AA" size={16} />
          </Pressable>
        ))
      )}
      <Button
        label="Trainingspläne verwalten"
        variant="secondary"
        onPress={() => {
          onClose();
          router.push('/training-templates');
        }}
      />
    </Card>
  );
}

export default function TrainingScreen() {
  const date = useUiStore((state) => state.selectedDate);
  const sessions = useTrainingStore((state) => (date ? (state.sessionsByDate?.[date] ?? EMPTY_SESSIONS) : EMPTY_SESSIONS));
  const [showAttachSheet, setShowAttachSheet] = useState(false);

  const header = (
    <View>
      <Text className="text-xs font-semibold uppercase tracking-wide text-primary">Coach imi</Text>
      <Text className="text-3xl font-bold tracking-tight text-foreground">Training</Text>
    </View>
  );

  if (!date) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12">
          {header}
          <Card>
            <Text className="text-center text-sm text-text-secondary">Datum wird geladen…</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12">
        {header}

        <TrainingSyncBanner />

        <DateSelector workoutOnly />

        {(sessions ?? []).length === 0 && !showAttachSheet ? (
          <Card>
            <Text className="text-center text-sm text-text-secondary">Noch keine Trainingspläne vorhanden</Text>
          </Card>
        ) : (
          (sessions ?? []).map((session) => <SessionCard key={session.id} session={session} />)
        )}

        {showAttachSheet ? (
          <AttachTemplateSheet date={date} onClose={() => setShowAttachSheet(false)} />
        ) : (
          <Button
            label="Trainingstag anlegen"
            icon={<Plus color="#ffffff" size={18} />}
            onPress={() => setShowAttachSheet(true)}
          />
        )}

        <TrainingScienceTips />
      </ScrollView>
    </SafeAreaView>
  );
}
