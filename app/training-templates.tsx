import { router } from 'expo-router';
import { Dumbbell, Pencil, Plus, Send, Share2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { fetchFriendships, formatFriendLabel, type FriendListItem } from '@/services/friends';
import { extractShareCode, shareWorkoutPlan } from '@/services/workoutShare';
import { shareWorkoutPlanWithFriend } from '@/services/workoutPlanShares';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
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
          <View key={exercise.key} className="gap-2 rounded-2xl border border-surface-border p-3 ">
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
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-border py-2.5 active:opacity-70 "
          onPress={() => setExercises((prev) => [...prev, blankExercise()])}
        >
          <Plus color="#6366F1" size={14} />
          <Text className="text-xs font-medium text-primary">Übung hinzufügen</Text>
        </Pressable>
      </View>

      <View className="flex-row gap-3">
        <Button label="Abbrechen" variant="secondary" onPress={onCancel} className="flex-1" />
        <Button label="Speichern" onPress={() => onSave(name.trim(), validExercises)} disabled={!canSave} className="flex-1" />
      </View>
    </Card>
  );
}

async function handleShare(template: WorkoutTemplate) {
  const toast = useToastStore.getState();
  try {
    const outcome = await shareWorkoutPlan(template);
    if (outcome === 'copied') toast.show('Link zum Plan in die Zwischenablage kopiert.', 'success');
  } catch (err) {
    console.error('[workout-share] share failed', err);
    toast.show('Plan konnte nicht geteilt werden.', 'error');
  }
}

/** Minimalist friend picker for sending a plan straight into a friend's inbox (services/workoutPlanShares.ts) - no link, no code, just pick who gets it. Only accepted friends show up, since sending is DB-gated on an accepted friendship anyway. */
function InternalShareSheet({
  template,
  friends,
  loading,
  onConfirm,
  onClose,
}: {
  template: WorkoutTemplate;
  friends: FriendListItem[];
  loading: boolean;
  onConfirm: (friendId: string) => void;
  onClose: () => void;
}) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm font-semibold text-text-secondary" numberOfLines={1}>
          &quot;{template.name}&quot; an Freund senden
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
              onPress={() => onConfirm(friend.profile.id)}
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

function ImportPlanForm({ onCancel }: { onCancel: () => void }) {
  const [input, setInput] = useState('');
  const code = extractShareCode(input);

  return (
    <Card className="gap-4">
      <TextField label="Code oder Link" value={input} onChangeText={setInput} placeholder="Geteilten Link oder Code einfügen" autoFocus />
      <View className="flex-row gap-3">
        <Button label="Abbrechen" variant="secondary" onPress={onCancel} className="flex-1" />
        <Button
          label="Weiter"
          onPress={() => router.push({ pathname: '/workout/import', params: { code } })}
          disabled={code.length === 0}
          className="flex-1"
        />
      </View>
    </Card>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
  onShare,
  onSendToFriend,
}: {
  template: WorkoutTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onSendToFriend: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface px-4 py-3  ">
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Dumbbell color="#6366F1" size={16} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{template.name}</Text>
          <Text className="text-xs text-text-secondary">{template.exercises.length} Übungen</Text>
        </View>
      </View>
      <View className="shrink-0 flex-row items-center gap-2">
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80"
          onPress={onSendToFriend}
          accessibilityLabel="An Freund senden"
        >
          <Send color="#6366F1" size={14} />
        </Pressable>
        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-80"
          onPress={onShare}
          accessibilityLabel="Plan teilen"
        >
          <Share2 color="#6366F1" size={14} />
        </Pressable>
        <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-overlay/5 active:opacity-80 " onPress={onEdit}>
          <Pencil color="#A1A1AA" size={14} />
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
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTemplate = templates.find((template) => template.id === editingId) ?? null;

  const myId = useSyncStore((state) => state.session?.user.id);
  const [sendTemplate, setSendTemplate] = useState<WorkoutTemplate | null>(null);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  async function handleOpenInternalShare(template: WorkoutTemplate) {
    setCreating(false);
    setImporting(false);
    setEditingId(null);
    setSendTemplate(template);
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

  async function handleConfirmInternalShare(friendId: string) {
    const template = sendTemplate;
    if (!template || !myId) return;
    setSendTemplate(null);
    try {
      await shareWorkoutPlanWithFriend(myId, friendId, template);
      useToastStore.getState().show('Plan gesendet', 'success');
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-foreground">Trainingspläne</Text>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md active:scale-95 active:opacity-80  "
          onPress={() => router.back()}
        >
          <X color="#A1A1AA" size={18} />
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
                setImporting(false);
                setSendTemplate(null);
                setEditingId(template.id);
              }}
              onDelete={() => removeTemplate(template.id)}
              onShare={() => handleShare(template)}
              onSendToFriend={() => handleOpenInternalShare(template)}
            />
          ),
        )}

        {sendTemplate && (
          <InternalShareSheet
            template={sendTemplate}
            friends={friends}
            loading={loadingFriends}
            onConfirm={handleConfirmInternalShare}
            onClose={() => setSendTemplate(null)}
          />
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

        {importing && <ImportPlanForm onCancel={() => setImporting(false)} />}

        {!creating && !editingTemplate && !importing && !sendTemplate && (
          <>
            <Button label="Neuer Trainingsplan" icon={<Plus color="#ffffff" size={18} />} onPress={() => setCreating(true)} />
            <Button label="Plan importieren" variant="secondary" onPress={() => setImporting(true)} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
