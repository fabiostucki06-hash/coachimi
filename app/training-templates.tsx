import { router } from 'expo-router';
import { Dumbbell, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useTrainingStore } from '@/store/trainingStore';
import type { TemplateExercise, WorkoutTemplate } from '@/types';

interface DraftExercise {
  key: string;
  name: string;
  targetSets: string;
  targetRepsMin: string;
  targetRepsMax: string;
}

function blankExercise(): DraftExercise {
  return { key: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, name: '', targetSets: '3', targetRepsMin: '8', targetRepsMax: '12' };
}

function toDraftExercises(exercises: TemplateExercise[]): DraftExercise[] {
  return exercises.map((exercise) => ({
    key: exercise.id,
    name: exercise.name,
    targetSets: String(exercise.targetSets),
    targetRepsMin: String(exercise.targetRepsMin),
    targetRepsMax: String(exercise.targetRepsMax),
  }));
}

function TemplateForm({
  initialName,
  initialExercises,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialExercises: DraftExercise[];
  onSave: (name: string, exercises: Omit<TemplateExercise, 'id'>[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [exercises, setExercises] = useState<DraftExercise[]>(initialExercises.length > 0 ? initialExercises : [blankExercise()]);

  function updateExercise(key: string, patch: Partial<DraftExercise>) {
    setExercises((prev) => prev.map((exercise) => (exercise.key === key ? { ...exercise, ...patch } : exercise)));
  }

  function removeExercise(key: string) {
    setExercises((prev) => prev.filter((exercise) => exercise.key !== key));
  }

  const validExercises = exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      targetSets: Math.max(1, Math.round(Number.parseFloat(exercise.targetSets) || 0)),
      targetRepsMin: Math.max(1, Math.round(Number.parseFloat(exercise.targetRepsMin) || 0)),
      targetRepsMax: Math.max(1, Math.round(Number.parseFloat(exercise.targetRepsMax) || 0)),
    }))
    .filter((exercise) => exercise.name.length > 0);

  const canSave = name.trim().length > 0 && validExercises.length > 0;

  return (
    <Card className="gap-4">
      <TextField label="Name des Plans" value={name} onChangeText={setName} placeholder="z. B. Push" autoFocus />

      <View className="gap-3">
        {exercises.map((exercise) => (
          <View key={exercise.key} className="gap-2 rounded-2xl border border-slate-200/60 p-3 dark:border-slate-800/60">
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <TextField label="Übung" value={exercise.name} onChangeText={(text) => updateExercise(exercise.key, { name: text })} placeholder="z. B. Bankdrücken" />
              </View>
              <Pressable
                className="h-[50px] w-[42px] items-center justify-center rounded-2xl bg-red-500/10 active:opacity-80"
                onPress={() => removeExercise(exercise.key)}
              >
                <Trash2 color="#ef4444" size={14} />
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextField label="Sätze" keyboardType="number-pad" value={exercise.targetSets} onChangeText={(text) => updateExercise(exercise.key, { targetSets: text })} />
              </View>
              <View className="flex-1">
                <TextField label="Wdh. min" keyboardType="number-pad" value={exercise.targetRepsMin} onChangeText={(text) => updateExercise(exercise.key, { targetRepsMin: text })} />
              </View>
              <View className="flex-1">
                <TextField label="Wdh. max" keyboardType="number-pad" value={exercise.targetRepsMax} onChangeText={(text) => updateExercise(exercise.key, { targetRepsMax: text })} />
              </View>
            </View>
          </View>
        ))}
        <Pressable
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300/70 py-2.5 active:opacity-70 dark:border-slate-700/70"
          onPress={() => setExercises((prev) => [...prev, blankExercise()])}
        >
          <Plus color="#10b981" size={14} />
          <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Übung hinzufügen</Text>
        </Pressable>
      </View>

      <View className="flex-row gap-3">
        <Button label="Abbrechen" variant="secondary" onPress={onCancel} className="flex-1" />
        <Button label="Speichern" onPress={() => onSave(name.trim(), validExercises)} disabled={!canSave} className="flex-1" />
      </View>
    </Card>
  );
}

function TemplateRow({ template, onEdit, onDelete }: { template: WorkoutTemplate; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/60">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
          <Dumbbell color="#10b981" size={16} />
        </View>
        <View>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white">{template.name}</Text>
          <Text className="text-xs text-slate-400">{template.exercises.length} Übungen</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-slate-100/70 active:opacity-80 dark:bg-white/5" onPress={onEdit}>
          <Pencil color="#64748b" size={14} />
        </Pressable>
        <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80" onPress={onDelete}>
          <Trash2 color="#ef4444" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TrainingTemplatesScreen() {
  const templates = useTrainingStore((state) => state.templates);
  const addTemplate = useTrainingStore((state) => state.addTemplate);
  const updateTemplate = useTrainingStore((state) => state.updateTemplate);
  const removeTemplate = useTrainingStore((state) => state.removeTemplate);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTemplate = templates.find((template) => template.id === editingId) ?? null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Trainingspläne</Text>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-slate-200/50 bg-slate-100/60 backdrop-blur-md active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
          onPress={() => router.back()}
        >
          <X color="#64748b" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-6 pt-4 pb-12">
        {templates.map((template) =>
          editingId === template.id ? null : (
            <TemplateRow
              key={template.id}
              template={template}
              onEdit={() => {
                setCreating(false);
                setEditingId(template.id);
              }}
              onDelete={() => removeTemplate(template.id)}
            />
          ),
        )}

        {editingTemplate && (
          <TemplateForm
            initialName={editingTemplate.name}
            initialExercises={toDraftExercises(editingTemplate.exercises)}
            onCancel={() => setEditingId(null)}
            onSave={(name, exercises) => {
              updateTemplate(editingTemplate.id, name, exercises);
              setEditingId(null);
            }}
          />
        )}

        {creating && (
          <TemplateForm
            initialName=""
            initialExercises={[]}
            onCancel={() => setCreating(false)}
            onSave={(name, exercises) => {
              addTemplate(name, exercises);
              setCreating(false);
            }}
          />
        )}

        {!creating && !editingTemplate && (
          <Button label="Neuer Trainingsplan" icon={<Plus color="#ffffff" size={18} />} onPress={() => setCreating(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
