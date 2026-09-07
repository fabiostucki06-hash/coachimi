import { ChevronRight, Dumbbell, Minus, Plus, Sparkles, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DateSelector } from '@/components/features/DateSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTrainingStore, getSessionsForExercise } from '@/store/trainingStore';
import { useUiStore } from '@/store/uiStore';
import type { LoggedExercise, WorkoutSession } from '@/types';
import { compareToPrevious, generateProgressionTip } from '@/utils/trainingProgression';

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function DeltaBadge({ label, pct }: { label: string; pct: number | null }) {
  if (pct === null) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 dark:bg-white/5">
        <Text className="text-[11px] font-medium text-slate-400">{label}: neu</Text>
      </View>
    );
  }

  const rounded = Math.round(pct * 10) / 10;
  const isUp = rounded > 0.05;
  const isDown = rounded < -0.05;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = isUp ? '#10b981' : isDown ? '#ef4444' : '#94a3b8';
  const bg = isUp ? 'bg-emerald-500/10' : isDown ? 'bg-red-500/10' : 'bg-slate-100/80 dark:bg-white/5';

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

  return (
    <View className="gap-3 border-t border-slate-200/50 pt-3 dark:border-slate-800/60">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">{exercise.name}</Text>
        <Text className="text-[11px] text-slate-400">
          Ziel: {exercise.targetRepsMin}-{exercise.targetRepsMax} Wdh.
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <DeltaBadge label="Volumen" pct={comparison.volumePct} />
        <DeltaBadge label="Kraft" pct={comparison.strengthPct} />
      </View>

      <View className="gap-2">
        {(exercise.sets ?? []).map((set, index) => (
          <View key={index} className="flex-row items-center gap-2">
            <Text className="w-5 text-xs text-slate-400">{index + 1}</Text>
            <TextInput
              className="flex-1 rounded-xl border border-slate-200/70 bg-[#EDF2F7] px-3 py-2 text-sm text-slate-900 dark:border-slate-800/60 dark:bg-white/5 dark:text-white"
              keyboardType="decimal-pad"
              value={set.weightKg ? String(set.weightKg) : ''}
              placeholder="kg"
              placeholderTextColor="#94a3b8"
              onChangeText={(text) => updateSet(session.date, session.id, exercise.id, index, { weightKg: parseNumber(text, 0) })}
            />
            <TextInput
              className="flex-1 rounded-xl border border-slate-200/70 bg-[#EDF2F7] px-3 py-2 text-sm text-slate-900 dark:border-slate-800/60 dark:bg-white/5 dark:text-white"
              keyboardType="number-pad"
              value={set.reps ? String(set.reps) : ''}
              placeholder="Wdh."
              placeholderTextColor="#94a3b8"
              onChangeText={(text) => updateSet(session.date, session.id, exercise.id, index, { reps: Math.round(parseNumber(text, 0)) })}
            />
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80"
              onPress={() => removeSet(session.date, session.id, exercise.id, index)}
            >
              <X color="#ef4444" size={12} />
            </Pressable>
          </View>
        ))}
        <Pressable
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300/70 py-2 active:opacity-70 dark:border-slate-700/70"
          onPress={() => addSet(session.date, session.id, exercise.id)}
        >
          <Plus color="#10b981" size={14} />
          <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Satz hinzufügen</Text>
        </Pressable>
      </View>

      <View className="flex-row items-start gap-2 rounded-xl bg-emerald-500/5 p-2.5">
        <Sparkles color="#10b981" size={14} />
        <Text className="flex-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-400">{tip}</Text>
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
          <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
            <Dumbbell color="#10b981" size={16} />
          </View>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white">{session.templateName}</Text>
        </View>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-slate-100/70 active:opacity-80 dark:bg-white/5"
          onPress={() => removeSession(session.date, session.id)}
        >
          <Trash2 color="#64748b" size={14} />
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
        <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Vorlage anhängen</Text>
        <Pressable onPress={onClose}>
          <X color="#64748b" size={16} />
        </Pressable>
      </View>
      {(templates ?? []).length === 0 ? (
        <Text className="text-sm text-slate-400">Noch keine Trainingspläne erstellt.</Text>
      ) : (
        (templates ?? []).map((template) => (
          <Pressable
            key={template.id}
            className="flex-row items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 active:opacity-80 dark:border-slate-800/60 dark:bg-slate-900/60"
            onPress={() => {
              attachTemplateToDate(date, template.id);
              onClose();
            }}
          >
            <View>
              <Text className="text-sm font-semibold text-slate-900 dark:text-white">{template.name}</Text>
              <Text className="text-xs text-slate-400">{template.exercises.length} Übungen</Text>
            </View>
            <ChevronRight color="#94a3b8" size={16} />
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
  const sessions = useTrainingStore((state) => state.sessionsByDate[date] ?? []);
  const [showAttachSheet, setShowAttachSheet] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12">
        <View>
          <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Coach imi</Text>
          <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Training</Text>
        </View>

        <DateSelector />

        {(sessions ?? []).length === 0 && !showAttachSheet ? (
          <Card>
            <Text className="text-center text-sm text-slate-400">Noch keine Trainingspläne vorhanden</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
