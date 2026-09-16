import { CalendarRange, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { CYCLE_TYPE_META } from '@/services/cycleEngine';
import { todayKey } from '@/store/diaryStore';
import { useCycleStore, type DietCycleInput } from '@/store/cycleStore';
import type { DietCycle, DietCycleType, Macros } from '@/types';
import { formatDateShort } from '@/utils/calendarDates';

const CYCLE_TYPE_OPTIONS: { id: DietCycleType; label: string }[] = [
  { id: 'strict', label: 'Strikt' },
  { id: 'cheat', label: 'Cheat / Refeed' },
  { id: 'maintenance', label: 'Erhaltung' },
  { id: 'custom', label: 'Individuell' },
];

interface CycleFormState {
  name: string;
  type: DietCycleType;
  startDate: string;
  endDate: string;
  targetDisabled: boolean;
  carbsOverride: string;
  proteinOverride: string;
  fatOverride: string;
}

function emptyForm(): CycleFormState {
  const today = todayKey();
  return {
    name: '',
    type: 'strict',
    startDate: today,
    endDate: today,
    targetDisabled: false,
    carbsOverride: '',
    proteinOverride: '',
    fatOverride: '',
  };
}

function formFromCycle(cycle: DietCycle): CycleFormState {
  return {
    name: cycle.name,
    type: cycle.type,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    targetDisabled: cycle.targetDisabled,
    carbsOverride: cycle.targetOverrides?.carbs !== undefined ? String(cycle.targetOverrides.carbs) : '',
    proteinOverride: cycle.targetOverrides?.protein !== undefined ? String(cycle.targetOverrides.protein) : '',
    fatOverride: cycle.targetOverrides?.fat !== undefined ? String(cycle.targetOverrides.fat) : '',
  };
}

function parseOverrideGrams(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const parsed = Number.parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function formToInput(form: CycleFormState): DietCycleInput {
  const overrides: Partial<Macros> = {};
  const carbs = parseOverrideGrams(form.carbsOverride);
  const protein = parseOverrideGrams(form.proteinOverride);
  const fat = parseOverrideGrams(form.fatOverride);
  if (carbs !== undefined) overrides.carbs = carbs;
  if (protein !== undefined) overrides.protein = protein;
  if (fat !== undefined) overrides.fat = fat;

  return {
    name: form.name.trim(),
    type: form.type,
    startDate: form.startDate,
    endDate: form.endDate,
    targetDisabled: form.targetDisabled,
    targetOverrides: Object.keys(overrides).length > 0 ? overrides : null,
  };
}

function CycleRow({ cycle, onEdit, onDelete }: { cycle: DietCycle; onEdit: () => void; onDelete: () => void }) {
  const { color, label } = CYCLE_TYPE_META[cycle.type];
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface p-4">
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {cycle.name}
          </Text>
          <Text className="text-xs text-text-secondary">
            {label} · {formatDateShort(cycle.startDate)} – {formatDateShort(cycle.endDate)}
          </Text>
          {cycle.targetDisabled && <Text className="text-xs text-amber-500">Tagesziele ausgesetzt</Text>}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onEdit}
          className="h-8 w-8 items-center justify-center rounded-full bg-overlay/5 active:opacity-80"
          accessibilityLabel="Zyklus bearbeiten"
        >
          <Pencil color="#A1A1AA" size={14} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80"
          accessibilityLabel="Zyklus löschen"
        >
          <Trash2 color="#ef4444" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

export function CycleManagerBody() {
  const cycles = useCycleStore((state) => state.cycles);
  const addCycle = useCycleStore((state) => state.addCycle);
  const updateCycle = useCycleStore((state) => state.updateCycle);
  const removeCycle = useCycleStore((state) => state.removeCycle);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CycleFormState>(emptyForm());

  const sortedCycles = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const isDateRangeValid = form.endDate >= form.startDate;
  const isFormValid = form.name.trim().length > 0 && isDateRangeValid;

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(cycle: DietCycle) {
    setEditingId(cycle.id);
    setForm(formFromCycle(cycle));
    setShowForm(true);
  }

  function handleSave() {
    if (!isFormValid) return;
    const input = formToInput(form);
    if (editingId) {
      updateCycle(editingId, input);
    } else {
      addCycle(input);
    }
    setShowForm(false);
  }

  if (showForm) {
    return (
      <View className="gap-4">
        <TextField label="Name" value={form.name} onChangeText={(text) => setForm((f) => ({ ...f, name: text }))} placeholder="z.B. Keto Phase" />

        <View className="gap-1.5">
          <Text className="text-xs font-medium tracking-tight text-text-secondary">Typ</Text>
          <View className="flex-row flex-wrap gap-2">
            {CYCLE_TYPE_OPTIONS.map((option) => {
              const isSelected = option.id === form.type;
              const { color } = CYCLE_TYPE_META[option.id];
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setForm((f) => ({ ...f, type: option.id }))}
                  className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2 active:opacity-80 ${
                    isSelected ? 'border-primary/60 bg-primary/10' : 'border-surface-border bg-overlay/5'
                  }`}
                >
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <Text className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-text-secondary'}`}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField label="Start" value={form.startDate} onChange={(date) => setForm((f) => ({ ...f, startDate: date }))} />
          </View>
          <View className="flex-1">
            <DateField label="Ende" value={form.endDate} onChange={(date) => setForm((f) => ({ ...f, endDate: date }))} />
          </View>
        </View>
        {!isDateRangeValid && <Text className="text-xs text-red-500">Enddatum darf nicht vor dem Startdatum liegen.</Text>}

        <View className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-overlay/5 px-5 py-3.5">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-foreground">Tagesziele aussetzen</Text>
            <Text className="text-xs text-text-secondary">Für Cheat-/Break-Tage: keine Zielwarnung, stattdessen ein Badge.</Text>
          </View>
          <Switch
            value={form.targetDisabled}
            onValueChange={(value) => setForm((f) => ({ ...f, targetDisabled: value }))}
            trackColor={{ false: '#52525B', true: '#6366F1' }}
            thumbColor="#ffffff"
          />
        </View>

        {!form.targetDisabled && (
          <View className="gap-2">
            <Text className="text-xs font-medium tracking-tight text-text-secondary">Makro-Override (optional, leer = normales Ziel)</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Carbs" keyboardType="decimal-pad" value={form.carbsOverride} onChangeText={(text) => setForm((f) => ({ ...f, carbsOverride: text }))} suffix="g" />
              </View>
              <View className="flex-1">
                <TextField label="Protein" keyboardType="decimal-pad" value={form.proteinOverride} onChangeText={(text) => setForm((f) => ({ ...f, proteinOverride: text }))} suffix="g" />
              </View>
              <View className="flex-1">
                <TextField label="Fett" keyboardType="decimal-pad" value={form.fatOverride} onChangeText={(text) => setForm((f) => ({ ...f, fatOverride: text }))} suffix="g" />
              </View>
            </View>
          </View>
        )}

        <View className="flex-row gap-3 pt-1">
          <Button label="Abbrechen" variant="secondary" onPress={() => setShowForm(false)} className="flex-1" />
          <Button label={editingId ? 'Speichern' : 'Erstellen'} onPress={handleSave} disabled={!isFormValid} className="flex-1" />
        </View>
      </View>
    );
  }

  return (
    <>
      <Button label="Neuen Zyklus anlegen" icon={<Plus color="#ffffff" size={18} />} onPress={openCreateForm} />
      {sortedCycles.length === 0 ? (
        <Text className="py-6 text-center text-sm text-text-secondary">Noch keine Zyklen geplant.</Text>
      ) : (
        <View className="gap-3">
          {sortedCycles.map((cycle) => (
            <CycleRow key={cycle.id} cycle={cycle} onEdit={() => openEditForm(cycle)} onDelete={() => removeCycle(cycle.id)} />
          ))}
        </View>
      )}
    </>
  );
}

interface CycleManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CycleManagerModal({ visible, onClose }: CycleManagerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-surface/50" onPress={onClose}>
        <Pressable className="max-h-[88%] gap-5 rounded-t-[32px] bg-background px-6 pb-8 pt-5" onPress={(e) => e.stopPropagation()}>
          <View className="items-center">
            <View className="h-1.5 w-10 rounded-full bg-overlay/20" />
          </View>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 flex-row items-center gap-2.5 pr-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <CalendarRange color="#6366F1" size={16} />
              </View>
              <Text className="text-xl font-bold tracking-tight text-foreground">Diät-Zyklen</Text>
            </View>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-overlay/10 active:opacity-80"
              onPress={onClose}
              accessibilityLabel="Schliessen"
            >
              <X color="#A1A1AA" size={18} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 pb-4">
            <CycleManagerBody />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
