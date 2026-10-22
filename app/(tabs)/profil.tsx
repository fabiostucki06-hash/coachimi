import { router } from 'expo-router';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Droplet,
  Egg,
  LogOut,
  Minus,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wheat,
  X,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalBackupCard } from '@/components/features/LocalBackupCard';
import { NotificationSettingsRow } from '@/components/features/NotificationSettingsRow';
import { NutrientVisibilitySelector } from '@/components/features/NutrientVisibilitySelector';
import { PatchNotes } from '@/components/features/PatchNotes';
import { ThemeToggle } from '@/components/features/ThemeToggle';
import { UsernameEditor } from '@/components/features/UsernameEditor';
import { UserAvatar } from '@/components/features/UserAvatar';
import { ACTIVITY_OPTIONS, ChipGroup, DIET_TYPE_OPTIONS, GENDER_OPTIONS, GOAL_OPTIONS } from '@/components/features/ProfileOptions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { LineChart } from '@/components/ui/LineChart';
import { TextField } from '@/components/ui/TextField';
import { NUTRIENT_META, NUTRIENT_ORDER } from '@/components/features/nutrientMeta';
import { getDietTargetSummary, getMicronutrientGoalsForDiet, PROTEIN_FLOOR_G_PER_KG } from '@/services/dietEngine';
import { AvatarUploadError, pickAndUploadAvatar } from '@/services/profile';
import { useProfileStore } from '@/store/profileStore';
import { RANKS, useRewardStore } from '@/store/rewardStore';
import { useSyncStore } from '@/store/syncStore';
import { useToastStore } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import type { Micronutrients, WeightEntry } from '@/types';
import { formatDateShort } from '@/utils/calendarDates';
import type { ActivityLevel, Gender, Goal } from '@/utils/nutritionCalculator';

// Shared line-art weight for every icon on this screen (lucide defaults to 2).
const STROKE = 1.75;

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text className="text-xs font-medium uppercase tracking-wider text-text-secondary">{children}</Text>;
}

function formatKg(value: number, signed = false): string {
  const text = Math.abs(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (!signed) return text;
  return `${value < 0 ? '−' : value > 0 ? '+' : '±'}${text}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

/**
 * Change over (roughly) the last 30 days: latest entry vs. the earliest entry inside
 * that window. If the window only holds the latest entry, falls back to the entry
 * right before it so a sparse logger still sees a trend. `history` is ascending.
 */
function getWeightTrend(history: WeightEntry[]): { deltaKg: number; days: number } | null {
  if (history.length < 2) return null;
  const latest = history[history.length - 1];
  const inWindow = history.filter((entry) => daysBetween(entry.date, latest.date) <= 30);
  const baseline = inWindow.length > 1 ? inWindow[0] : history[history.length - 2];
  return { deltaKg: latest.weightKg - baseline.weightKg, days: Math.max(daysBetween(baseline.date, latest.date), 1) };
}

function shortDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

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
      className={`flex-row items-center justify-between rounded-2xl border bg-overlay/5 px-5 py-3.5 transition-shadow duration-200 ease-in-out ${
        isFocused
          ? 'border-primary shadow-[0_0_0_4px_rgba(99,102,241,0.15)]'
          : 'border-surface-border shadow-none'
      }`}
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-sm font-semibold text-text-secondary">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <TextInput
          className="w-16 text-right text-sm font-semibold text-foreground"
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
      <View className="gap-2.5 rounded-2xl bg-primary/5 p-3">
        <DateField compact label="Datum" value={editDate} onChange={setEditDate} />
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <TextField compact label="Gewicht" keyboardType="decimal-pad" value={editWeight} onChangeText={setEditWeight} suffix="kg" />
          </View>
          <Button size="sm" label="Speichern" onPress={handleSave} />
          <Pressable
            onPress={() => setIsEditing(false)}
            accessibilityLabel="Bearbeiten abbrechen"
            className="h-10 w-10 items-center justify-center rounded-xl bg-overlay/5 active:opacity-70"
          >
            <X color="#A1A1AA" size={16} strokeWidth={STROKE} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between py-2.5">
      <View className="gap-0.5">
        <Text className="text-[15px] font-medium leading-5 text-foreground">{formatKg(entry.weightKg)} kg</Text>
        <Text className="text-xs leading-4 text-text-secondary">{formatDateShort(entry.date)}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={startEdit}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-overlay/10"
          accessibilityLabel="Eintrag bearbeiten"
        >
          <Pencil color="#A1A1AA" size={15} strokeWidth={STROKE} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-red-500/10"
          accessibilityLabel="Eintrag löschen"
        >
          <Trash2 color="#ef4444" size={15} strokeWidth={STROKE} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * One editable daily-target row for a non-macro nutrient (fiber, sugar, iron, ...) -
 * shown for every nutrient the user turned on in "Sichtbare Nährstoffe" below. Value
 * defaults to the diet-computed goal (`defaultGoal`) until the user sets their own via
 * `onChange`; the reset button clears back to that default via `onChange(undefined)`.
 * Commits on blur (not per-keystroke) so an in-progress edit like "1" isn't clamped
 * away before the user reaches "15".
 */
function MicronutrientGoalRow({
  label,
  Icon,
  color,
  unit,
  effectiveGoal,
  isOverridden,
  onChange,
}: {
  label: string;
  Icon: React.ComponentType<{ color?: string; size?: number }>;
  color: string;
  unit: string;
  effectiveGoal: number;
  isOverridden: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(String(effectiveGoal));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(String(effectiveGoal));
  }, [effectiveGoal, isFocused]);

  function commit() {
    setIsFocused(false);
    const parsed = Number.parseFloat(text.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChange(parsed);
    } else {
      setText(String(effectiveGoal));
    }
  }

  return (
    <View
      className={`flex-row items-center justify-between rounded-2xl border bg-overlay/5 px-5 py-3.5 transition-shadow duration-200 ease-in-out ${
        isFocused ? 'border-primary shadow-[0_0_0_4px_rgba(99,102,241,0.15)]' : 'border-surface-border shadow-none'
      }`}
    >
      <View className="flex-1 flex-row items-center gap-3 pr-3">
        <Icon color={color} size={18} />
        <Text className="flex-1 text-sm font-semibold text-text-secondary">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        {isOverridden && (
          <Pressable
            onPress={() => onChange(undefined)}
            accessibilityRole="button"
            accessibilityLabel={`${label}-Ziel auf Standard zurücksetzen`}
            className="h-6 w-6 items-center justify-center rounded-full bg-overlay/10 active:opacity-70"
          >
            <RotateCcw color="#A1A1AA" size={12} strokeWidth={STROKE} />
          </Pressable>
        )}
        <TextInput
          className="w-16 text-right text-sm font-semibold text-foreground"
          keyboardType="decimal-pad"
          value={text}
          onChangeText={setText}
          onFocus={() => setIsFocused(true)}
          onBlur={commit}
        />
        <Text className="text-sm font-semibold" style={{ color }}>
          {unit}
        </Text>
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
  const setDietType = useUserStore((state) => state.setDietType);
  const setAvatarUrl = useUserStore((state) => state.setAvatarUrl);
  const addWeightEntry = useUserStore((state) => state.addWeightEntry);
  const updateWeightEntry = useUserStore((state) => state.updateWeightEntry);
  const removeWeightEntry = useUserStore((state) => state.removeWeightEntry);
  const toggleNutrientVisibility = useUserStore((state) => state.toggleNutrientVisibility);
  const setMicronutrientGoalOverride = useUserStore((state) => state.setMicronutrientGoalOverride);
  const selectedDiaryDate = useUiStore((state) => state.selectedDate);
  const session = useSyncStore((state) => state.session);
  const signOut = useSyncStore((state) => state.signOut);
  const activeRank = useRewardStore((state) => state.activeRank);
  const activeRankName = RANKS.find((rank) => rank.id === activeRank)?.name ?? RANKS[0].name;
  const activeBorder = useRewardStore((state) => state.activeBorder);
  const myId = session?.user.id;
  const myEmail = session?.user.email ?? '';
  const friendProfile = useProfileStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace('/onboarding');
  }

  async function handlePickAvatar() {
    if (!myId || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(myId);
      if (url) setAvatarUrl(url);
    } catch (err) {
      showToast(err instanceof AvatarUploadError ? err.message : 'Profilbild-Upload fehlgeschlagen.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
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
  // 2.0g/kg is a hard floor system-wide (see services/dietEngine.ts's applyProteinFloor) -
  // a manual override here must not be able to undercut it. Falls back to 0 (no floor)
  // if weight isn't known yet, same as every other weight-pinned calc in this app.
  const proteinFloorG = Math.round((user.weightKg ?? 0) * PROTEIN_FLOOR_G_PER_KG);
  const isProteinBelowFloor = Number.isFinite(parsedProteinGoal) && parsedProteinGoal < proteinFloorG;
  const isGoalsFormValid =
    Number.isFinite(parsedCalorieGoal) &&
    parsedCalorieGoal > 0 &&
    Number.isFinite(parsedCarbsGoal) &&
    parsedCarbsGoal > 0 &&
    Number.isFinite(parsedProteinGoal) &&
    parsedProteinGoal > 0 &&
    !isProteinBelowFloor &&
    Number.isFinite(parsedFatGoal) &&
    parsedFatGoal > 0;

  const currentDietType = user.dietType ?? 'balanced';
  const dietTargetSummary = getDietTargetSummary(currentDietType);

  // Only nutrients the user actually turned on in "Sichtbare Nährstoffe" below get an
  // editable target row here - carbs/protein/fat are excluded, those already have
  // their own inputs in "Ziele" above.
  const micronutrientGoals = getMicronutrientGoalsForDiet(currentDietType, user.gender, user.micronutrientGoalOverrides);
  const visibleExtraNutrients = NUTRIENT_ORDER.filter(
    (key) => user.visibleNutrients[key] && NUTRIENT_META[key].category !== 'macro',
  ) as (keyof Micronutrients)[];

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

  const chartData = weightHistory.map((entry) => ({ value: entry.weightKg, label: shortDateLabel(entry.date) }));
  const latestWeight = weightHistory[weightHistory.length - 1];
  const weightTrend = getWeightTrend(weightHistory);
  const sortedHistoryDesc = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));
  const parsedNewWeight = Number.parseFloat(newWeight.replace(',', '.'));
  const isNewWeightValid = Number.isFinite(parsedNewWeight) && parsedNewWeight > 0;

  // A trend is "good" when it moves toward the selected goal; for maintain/endurance
  // any change is just shown neutrally.
  const trendDirection = !weightTrend || Math.abs(weightTrend.deltaKg) < 0.05 ? 0 : Math.sign(weightTrend.deltaKg);
  const wantedDirection = user.goal === 'weight_loss' ? -1 : user.goal === 'muscle_gain' ? 1 : 0;
  const trendTone =
    trendDirection === 0 || wantedDirection === 0
      ? { pill: 'bg-overlay/5', text: 'text-text-secondary', icon: '#A1A1AA' }
      : trendDirection === wantedDirection
        ? { pill: 'bg-emerald-500/10', text: 'text-emerald-500', icon: '#10b981' }
        : { pill: 'bg-amber-500/10', text: 'text-amber-500', icon: '#f59e0b' };
  const TrendIcon = trendDirection < 0 ? TrendingDown : trendDirection > 0 ? TrendingUp : Minus;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12"
      >
        <Text className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">Profil</Text>

        <View className="items-center gap-3 rounded-[28px] border border-surface-border bg-surface py-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} className="relative active:opacity-80">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} frameId={activeBorder} size={72} />
            <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary">
              {uploadingAvatar ? <ActivityIndicator size="small" color="#ffffff" /> : <Camera color="#ffffff" size={12} strokeWidth={2} />}
            </View>
          </Pressable>
          <View className="items-center gap-1">
            <Text className="text-lg font-semibold tracking-tight text-foreground">{user.name || 'Ohne Namen'}</Text>
            {friendProfile?.username && <Text className="text-sm font-medium text-primary">@{friendProfile.username}</Text>}
            {activeRank !== 'neuling' && (
              <View className="rounded-full bg-amber-400/15 px-2.5 py-0.5">
                <Text className="text-xs font-bold text-amber-400">{activeRankName}</Text>
              </View>
            )}
            <Text className="text-sm text-text-secondary">{user.email || 'Keine E-Mail hinterlegt'}</Text>
          </View>
        </View>

        <Card className="gap-4">
          <SectionTitle>Konto</SectionTitle>
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
          {myId && (
            <View className="gap-2 border-t border-surface-border pt-3">
              <UsernameEditor myId={myId} email={myEmail} />
            </View>
          )}
        </Card>

        <View className="gap-2">
          <SectionTitle>Ziele</SectionTitle>
          <GoalInputRow icon={<Target color="#6366F1" size={18} strokeWidth={STROKE} />} label="Tagesziel Kalorien" value={calorieGoal} onChangeText={setCalorieGoal} suffix="kcal" accentColor="#6366F1" />
          <GoalInputRow icon={<Wheat color="#3b82f6" size={18} strokeWidth={STROKE} />} label="Carbs" value={carbsGoal} onChangeText={handleCarbsChange} suffix="g" accentColor="#3b82f6" />
          <GoalInputRow icon={<Egg color="#ef4444" size={18} strokeWidth={STROKE} />} label="Protein" value={proteinGoal} onChangeText={handleProteinChange} suffix="g" accentColor="#ef4444" />
          {isProteinBelowFloor && (
            <Text className="px-1 text-xs text-red-500">
              Mindestens {proteinFloorG}g Protein (2.0g/kg Körpergewicht) - Muskelerhalt-Untergrenze.
            </Text>
          )}
          <GoalInputRow icon={<Droplet color="#f59e0b" size={18} strokeWidth={STROKE} />} label="Fett" value={fatGoal} onChangeText={handleFatChange} suffix="g" accentColor="#f59e0b" />
          {dietTargetSummary && <Text className="px-1 text-xs text-text-secondary">{dietTargetSummary}</Text>}
          <Button label="Ziele speichern" onPress={handleSaveGoals} disabled={!isGoalsFormValid} className="mt-1" />
        </View>

        <Card className="gap-2">
          <SectionTitle>Ernährungsstil</SectionTitle>
          <Text className="text-xs text-text-secondary">
            Passt Makroziele, MND-Bewertung und Essensvorschläge sofort an - keine weitere Bestätigung nötig.
          </Text>
          <ChipGroup options={DIET_TYPE_OPTIONS} selected={currentDietType} onSelect={setDietType} />
          {dietTargetSummary && <Text className="text-xs text-text-secondary">{dietTargetSummary}</Text>}
        </Card>

        <Card className="gap-4">
          <SectionTitle>Ziel wählen</SectionTitle>
          <ChipGroup options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />

          <Text className="pt-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Körperdaten</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField label="Alter" keyboardType="number-pad" value={age} onChangeText={setAge} suffix="Jahre" />
            </View>
            <View className="flex-1">
              <TextField label="Größe" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} suffix="cm" />
            </View>
          </View>
          <TextField label="Gewicht" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} suffix="kg" />

          <Text className="text-xs font-medium text-text-secondary">Geschlecht</Text>
          <ChipGroup options={GENDER_OPTIONS} selected={gender} onSelect={setGender} />

          <Text className="text-xs font-medium text-text-secondary">Aktivitätslevel</Text>
          <ChipGroup options={ACTIVITY_OPTIONS} selected={activityLevel} onSelect={setActivityLevel} />

          <Button label="BMR/TDEE berechnen & speichern" onPress={handleSaveProfile} disabled={!isFormValid} className="mt-2" />
        </Card>

        <Card className="gap-1">
          <NutrientVisibilitySelector visibleNutrients={user.visibleNutrients} onToggle={toggleNutrientVisibility} />
        </Card>

        {visibleExtraNutrients.length > 0 && (
          <Card className="gap-2">
            <SectionTitle>Tagesbedarf: Extra Nährstoffe</SectionTitle>
            <Text className="text-xs text-text-secondary">
              Eigene Ziele für die oben ausgewählten Nährstoffe - ohne Eingabe gilt der aus deinem Ernährungsstil berechnete Standardwert.
            </Text>
            {visibleExtraNutrients.map((key) => {
              const { label, unit, color, Icon } = NUTRIENT_META[key];
              return (
                <MicronutrientGoalRow
                  key={key}
                  label={label}
                  Icon={Icon}
                  color={color}
                  unit={unit}
                  effectiveGoal={micronutrientGoals[key]}
                  isOverridden={user.micronutrientGoalOverrides?.[key] !== undefined}
                  onChange={(value) => setMicronutrientGoalOverride(key, value)}
                />
              );
            })}
          </Card>
        )}

        {/* Flat settings list - no card chrome, rows separated by hairlines. */}
        <View className="gap-1">
          <SectionTitle>Einstellungen</SectionTitle>
          <View className="gap-3 border-b border-surface-border/60 py-3">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Palette color="#6366F1" size={18} strokeWidth={STROKE} />
              </View>
              <Text className="text-[15px] font-medium leading-5 text-foreground">Darstellung</Text>
            </View>
            <ThemeToggle />
          </View>
          <NotificationSettingsRow />
        </View>

        <LocalBackupCard />

        <Card className="gap-5 p-5">
          <View className="flex-row items-start justify-between">
            <View className="gap-1">
              <View className="flex-row items-center gap-1.5">
                <Scale color="#A1A1AA" size={14} strokeWidth={STROKE} />
                <Text className="text-xs font-medium uppercase tracking-wider text-text-secondary">Gewichtsverlauf</Text>
              </View>
              <Text className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">
                {latestWeight ? formatKg(latestWeight.weightKg) : '–'}
                <Text className="text-base font-normal text-text-secondary"> kg</Text>
              </Text>
            </View>
            {weightTrend && (
              <View className={`mt-1 flex-row items-center gap-1 rounded-full px-2.5 py-1 ${trendTone.pill}`}>
                <TrendIcon color={trendTone.icon} size={14} strokeWidth={2} />
                <Text className={`text-xs font-semibold ${trendTone.text}`}>
                  {formatKg(weightTrend.deltaKg, true)} kg
                </Text>
              </View>
            )}
          </View>
          {weightTrend && (
            <Text className="-mt-3 text-xs leading-4 text-text-secondary">
              Trend: {trendDirection < 0 ? 'runter' : trendDirection > 0 ? 'rauf' : 'stabil'} um {formatKg(weightTrend.deltaKg)} kg in{' '}
              {weightTrend.days === 1 ? '1 Tag' : `${weightTrend.days} Tagen`}
            </Text>
          )}

          <LineChart data={chartData} color="#6366F1" unit="kg" />

          <View className="gap-2.5">
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <DateField compact label="Datum" value={newWeightDate} onChange={setNewWeightDate} />
              </View>
              <View className="flex-1">
                <TextField
                  compact
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
              size="sm"
              label="Eintragen"
              icon={<Plus color="#ffffff" size={16} strokeWidth={2} />}
              onPress={handleAddWeight}
              disabled={!isNewWeightValid}
              className="self-end"
            />
          </View>

          {weightHistory.length > 0 && (
            <View>
              <Pressable
                onPress={() => setShowWeightHistory((prev) => !prev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWeightHistory }}
                className="flex-row items-center justify-between border-t border-surface-border/60 pt-3.5 active:opacity-70"
              >
                <Text className="text-sm font-medium text-text-secondary">Verlauf bearbeiten ({weightHistory.length})</Text>
                {showWeightHistory ? (
                  <ChevronUp color="#A1A1AA" size={18} strokeWidth={STROKE} />
                ) : (
                  <ChevronDown color="#A1A1AA" size={18} strokeWidth={STROKE} />
                )}
              </Pressable>

              {showWeightHistory && (
                <View className="mt-1">
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
            </View>
          )}
        </Card>

        <PatchNotes />

        {session && (
          <Pressable
            onPress={handleSignOut}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-3.5 active:bg-red-500/10"
          >
            <LogOut color="#f87171" size={18} strokeWidth={STROKE} />
            <Text className="text-base font-semibold text-red-400">Abmelden</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
