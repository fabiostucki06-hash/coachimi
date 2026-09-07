import { router } from 'expo-router';
import { ChevronDown, Droplet, Egg, LogOut, Pencil, Plus, Scale, Target, Trash2, Wheat, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloudSyncCard } from '@/components/features/CloudSyncCard';
import { HealthAdvisor } from '@/components/features/HealthAdvisor';
import { NutrientVisibilitySelector } from '@/components/features/NutrientVisibilitySelector';
import { SupplementRecommendations } from '@/components/features/SupplementRecommendations';
import { ACTIVITY_OPTIONS, ChipGroup, GENDER_OPTIONS, GOAL_OPTIONS, THEME_OPTIONS } from '@/components/features/ProfileOptions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { LineChart } from '@/components/ui/LineChart';
import { TextField } from '@/components/ui/TextField';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { WeightEntry } from '@/types';
import { formatDateShort } from '@/utils/calendarDates';
import type { ActivityLevel, Gender, Goal } from '@/utils/nutritionCalculator';

function GoalInputRow({
  icon,
  label,
  value,
  onChangeText,
  suffix,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suffix: string;
  accentColor: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      className={`flex-row items-center justify-between rounded-2xl border bg-[#EDF2F7] px-5 py-3.5 transition-shadow duration-200 ease-in-out dark:bg-white/5 ${
        isFocused
          ? 'border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] dark:border-emerald-400/70'
          : 'border-slate-200/70 shadow-none dark:border-slate-800/60'
      }`}
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <TextInput
          className="w-16 text-right text-sm font-semibold text-slate-900 dark:text-white"
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Text className="text-sm font-semibold" style={{ color: accentColor }}>
          {suffix}
        </Text>
      </View>
    </View>
  );
}

function WeightHistoryRow({
  entry,
  onSave,
  onDelete,
}: {
  entry: WeightEntry;
  onSave: (changes: { date: string; weightKg: number }) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState(String(entry.weightKg));
  const [editDate, setEditDate] = useState(entry.date);

  function startEdit() {
    setEditWeight(String(entry.weightKg));
    setEditDate(entry.date);
    setIsEditing(true);
  }

  function handleSave() {
    const parsed = Number.parseFloat(editWeight.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onSave({ date: editDate, weightKg: parsed });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <View className="gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3">
        <DateField label="Datum" value={editDate} onChange={setEditDate} />
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <TextField label="Gewicht" keyboardType="decimal-pad" value={editWeight} onChangeText={setEditWeight} suffix="kg" />
          </View>
          <Pressable
            onPress={handleSave}
            className="h-[50px] items-center justify-center rounded-2xl bg-emerald-500 px-4 active:bg-emerald-600"
          >
            <Text className="text-sm font-semibold text-white">Speichern</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsEditing(false)}
            className="h-[50px] w-[50px] items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5"
          >
            <X color="#64748b" size={18} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/60">
      <View>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">{entry.weightKg} kg</Text>
        <Text className="text-xs text-slate-400">{formatDateShort(entry.date)}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={startEdit}
          className="h-8 w-8 items-center justify-center rounded-full bg-slate-100/70 active:opacity-80 dark:bg-white/5"
          accessibilityLabel="Eintrag bearbeiten"
        >
          <Pencil color="#64748b" size={14} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="h-8 w-8 items-center justify-center rounded-full bg-red-500/10 active:opacity-80"
          accessibilityLabel="Eintrag löschen"
        >
          <Trash2 color="#ef4444" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilScreen() {
  const user = useUserStore((state) => state.user);
  const weightHistory = useUserStore((state) => state.weightHistory);
  const updateAccount = useUserStore((state) => state.updateAccount);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const updateGoals = useUserStore((state) => state.updateGoals);
  const addWeightEntry = useUserStore((state) => state.addWeightEntry);
  const updateWeightEntry = useUserStore((state) => state.updateWeightEntry);
  const removeWeightEntry = useUserStore((state) => state.removeWeightEntry);
  const toggleNutrientVisibility = useUserStore((state) => state.toggleNutrientVisibility);
  const themePreference = useThemeStore((state) => state.themePreference);
  const setThemePreference = useThemeStore((state) => state.setThemePreference);
  const selectedDiaryDate = useUiStore((state) => state.selectedDate);
  const session = useSyncStore((state) => state.session);
  const signOut = useSyncStore((state) => state.signOut);

  async function handleSignOut() {
    await signOut();
    router.replace('/onboarding');
  }

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [age, setAge] = useState(String(user.age ?? 30));
  const [gender, setGender] = useState<Gender>(user.gender ?? 'male');
  const [heightCm, setHeightCm] = useState(String(user.heightCm ?? 180));
  const [weightKg, setWeightKg] = useState(String(user.weightKg ?? 78));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(user.activityLevel ?? 'moderate');
  const [goal, setGoal] = useState<Goal>(user.goal ?? 'maintain');
  const [newWeight, setNewWeight] = useState('');
  const [newWeightDate, setNewWeightDate] = useState(selectedDiaryDate);
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(String(user.dailyCalorieGoal));
  const [carbsGoal, setCarbsGoal] = useState(String(user.dailyMacroGoal.carbs));
  const [proteinGoal, setProteinGoal] = useState(String(user.dailyMacroGoal.protein));
  const [fatGoal, setFatGoal] = useState(String(user.dailyMacroGoal.fat));

  useEffect(() => {
    setCalorieGoal(String(user.dailyCalorieGoal));
    setCarbsGoal(String(user.dailyMacroGoal.carbs));
    setProteinGoal(String(user.dailyMacroGoal.protein));
    setFatGoal(String(user.dailyMacroGoal.fat));
  }, [user.dailyCalorieGoal, user.dailyMacroGoal.carbs, user.dailyMacroGoal.protein, user.dailyMacroGoal.fat]);

  // Recompute the calorie total only in response to an actual macro edit, not on
  // mount/external sync, since the stored macros don't perfectly round-trip to the
  // stored calorie goal (each macro is rounded independently).
  function recalcCalorieGoal(nextCarbs: string, nextProtein: string, nextFat: string) {
    const c = Number.parseFloat(nextCarbs.replace(',', '.'));
    const p = Number.parseFloat(nextProtein.replace(',', '.'));
    const f = Number.parseFloat(nextFat.replace(',', '.'));
    if (Number.isFinite(c) && Number.isFinite(p) && Number.isFinite(f)) {
      setCalorieGoal(String(Math.round(c * 4 + p * 4 + f * 9)));
    }
  }

  function handleCarbsChange(text: string) {
    setCarbsGoal(text);
    recalcCalorieGoal(text, proteinGoal, fatGoal);
  }

  function handleProteinChange(text: string) {
    setProteinGoal(text);
    recalcCalorieGoal(carbsGoal, text, fatGoal);
  }

  function handleFatChange(text: string) {
    setFatGoal(text);
    recalcCalorieGoal(carbsGoal, proteinGoal, text);
  }

  const initial = user.name.charAt(0).toUpperCase();

  const parsedAge = Number.parseInt(age, 10);
  const parsedHeight = Number.parseFloat(heightCm.replace(',', '.'));
  const parsedWeight = Number.parseFloat(weightKg.replace(',', '.'));
  const isFormValid =
    Number.isFinite(parsedAge) && parsedAge > 0 && Number.isFinite(parsedHeight) && parsedHeight > 0 && Number.isFinite(parsedWeight) && parsedWeight > 0;

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const isAccountValid = trimmedName.length > 0 && EMAIL_PATTERN.test(trimmedEmail);
  const isAccountDirty = trimmedName !== user.name || trimmedEmail !== user.email;

  const parsedCalorieGoal = Number.parseFloat(calorieGoal.replace(',', '.'));
  const parsedCarbsGoal = Number.parseFloat(carbsGoal.replace(',', '.'));
  const parsedProteinGoal = Number.parseFloat(proteinGoal.replace(',', '.'));
  const parsedFatGoal = Number.parseFloat(fatGoal.replace(',', '.'));
  const isGoalsFormValid =
    Number.isFinite(parsedCalorieGoal) &&
    parsedCalorieGoal > 0 &&
    Number.isFinite(parsedCarbsGoal) &&
    parsedCarbsGoal > 0 &&
    Number.isFinite(parsedProteinGoal) &&
    parsedProteinGoal > 0 &&
    Number.isFinite(parsedFatGoal) &&
    parsedFatGoal > 0;

  function handleSaveProfile() {
    if (!isFormValid) return;
    updateProfile({ age: parsedAge, gender, heightCm: parsedHeight, weightKg: parsedWeight, activityLevel, goal });
  }

  function handleSaveGoals() {
    if (!isGoalsFormValid) return;
    updateGoals({
      dailyCalorieGoal: Math.round(parsedCalorieGoal),
      dailyMacroGoal: { carbs: parsedCarbsGoal, protein: parsedProteinGoal, fat: parsedFatGoal },
    });
  }

  function handleSaveAccount() {
    if (!isAccountValid) return;
    updateAccount({ name: trimmedName, email: trimmedEmail });
  }

  function handleAddWeight() {
    const parsed = Number.parseFloat(newWeight.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    addWeightEntry(parsed, newWeightDate);
    setWeightKg(String(parsed));
    setNewWeight('');
  }

  const chartPoints = weightHistory.map((entry) => entry.weightKg);
  const firstDate = weightHistory[0]?.date;
  const lastDate = weightHistory[weightHistory.length - 1]?.date;
  const sortedHistoryDesc = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12"
      >
        <Text className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Profil</Text>

        <View className="items-center gap-3 rounded-[28px] border border-slate-200/70 bg-white py-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <Text className="text-2xl font-bold text-white">{initial || '?'}</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{user.name || 'Ohne Namen'}</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400">{user.email || 'Keine E-Mail hinterlegt'}</Text>
          </View>
        </View>

        <Card className="gap-4">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Konto</Text>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Max Mustermann" />
          <TextField
            label="E-Mail-Adresse"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="max@beispiel.de"
          />
          <Button
            label="Konto speichern"
            variant="secondary"
            onPress={handleSaveAccount}
            disabled={!isAccountValid || !isAccountDirty}
          />
        </Card>

        <Card className="gap-3">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Darstellung</Text>
          <ChipGroup options={THEME_OPTIONS} selected={themePreference} onSelect={setThemePreference} />
        </Card>

        <CloudSyncCard />

        <View className="gap-2">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ziele</Text>
          <GoalInputRow icon={<Target color="#10b981" size={18} />} label="Tagesziel Kalorien" value={calorieGoal} onChangeText={setCalorieGoal} suffix="kcal" accentColor="#10b981" />
          <GoalInputRow icon={<Wheat color="#3b82f6" size={18} />} label="Carbs" value={carbsGoal} onChangeText={handleCarbsChange} suffix="g" accentColor="#3b82f6" />
          <GoalInputRow icon={<Egg color="#ef4444" size={18} />} label="Protein" value={proteinGoal} onChangeText={handleProteinChange} suffix="g" accentColor="#ef4444" />
          <GoalInputRow icon={<Droplet color="#f59e0b" size={18} />} label="Fett" value={fatGoal} onChangeText={handleFatChange} suffix="g" accentColor="#f59e0b" />
          <Button label="Ziele speichern" onPress={handleSaveGoals} disabled={!isGoalsFormValid} className="mt-1" />
        </View>

        <Card className="gap-4">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ziel wählen</Text>
          <ChipGroup options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />

          <Text className="pt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Körperdaten</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField label="Alter" keyboardType="number-pad" value={age} onChangeText={setAge} suffix="Jahre" />
            </View>
            <View className="flex-1">
              <TextField label="Größe" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} suffix="cm" />
            </View>
          </View>
          <TextField label="Gewicht" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} suffix="kg" />

          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Geschlecht</Text>
          <ChipGroup options={GENDER_OPTIONS} selected={gender} onSelect={setGender} />

          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Aktivitätslevel</Text>
          <ChipGroup options={ACTIVITY_OPTIONS} selected={activityLevel} onSelect={setActivityLevel} />

          <Button label="BMR/TDEE berechnen & speichern" onPress={handleSaveProfile} disabled={!isFormValid} className="mt-2" />
        </Card>

        <Card className="gap-1">
          <NutrientVisibilitySelector visibleNutrients={user.visibleNutrients} onToggle={toggleNutrientVisibility} />
        </Card>

        <SupplementRecommendations />

        <HealthAdvisor />

        <Card className="gap-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100/70 dark:bg-white/5">
              <Scale color="#64748b" size={18} />
            </View>
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Gewichtsverlauf</Text>
          </View>

          <LineChart points={chartPoints} firstLabel={firstDate} lastLabel={lastDate} color="#10b981" />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField label="Datum" value={newWeightDate} onChange={setNewWeightDate} />
            </View>
            <View className="flex-1">
              <TextField
                label="Neues Gewicht"
                keyboardType="decimal-pad"
                value={newWeight}
                onChangeText={setNewWeight}
                suffix="kg"
                placeholder={String(user.weightKg ?? '')}
              />
            </View>
          </View>
          <Button
            label="Gewicht eintragen"
            icon={<Plus color="#ffffff" size={18} />}
            onPress={handleAddWeight}
            disabled={!Number.isFinite(Number.parseFloat(newWeight.replace(',', '.'))) || Number.parseFloat(newWeight.replace(',', '.')) <= 0}
          />

          {weightHistory.length > 0 && (
            <>
              <Pressable
                onPress={() => setShowWeightHistory((prev) => !prev)}
                className="flex-row items-center justify-between border-t border-slate-200/50 pt-3 dark:border-slate-800/60"
              >
                <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Verlauf bearbeiten ({weightHistory.length})
                </Text>
                <ChevronDown
                  color="#64748b"
                  size={18}
                  style={{ transform: [{ rotate: showWeightHistory ? '180deg' : '0deg' }] }}
                />
              </Pressable>

              {showWeightHistory && (
                <View className="gap-2">
                  {sortedHistoryDesc.map((entry) => (
                    <WeightHistoryRow
                      key={entry.id}
                      entry={entry}
                      onSave={(changes) => updateWeightEntry(entry.id, changes)}
                      onDelete={() => removeWeightEntry(entry.id)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </Card>

        {session && (
          <Pressable
            onPress={handleSignOut}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-3.5 active:bg-red-500/10"
          >
            <LogOut color="#f87171" size={18} />
            <Text className="text-base font-semibold text-red-400">Abmelden</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
