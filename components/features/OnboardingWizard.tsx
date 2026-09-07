import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ACTIVITY_OPTIONS,
  ChipGroup,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  MACRO_RATIO_OPTIONS,
  MICRONUTRIENT_FOCUS_OPTIONS,
} from '@/components/features/ProfileOptions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import {
  calculateBMR,
  calculateDailyTargets,
  calculateMacros,
  calculateTDEE,
  MACRO_RATIO_PRESET_VALUES,
  type ActivityLevel,
  type Gender,
  type Goal,
  type MacroRatioPreset,
  type MicronutrientFocus,
} from '@/utils/nutritionCalculator';

const STEPS = ['basics', 'activity', 'goal', 'macros', 'focus'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
  basics: { title: 'Deine Basisdaten', subtitle: 'Für die Berechnung deines Tagesbedarfs (Mifflin-St-Jeor).' },
  activity: { title: 'Aktivitätslevel', subtitle: 'Wie bewegst du dich normalerweise im Alltag?' },
  goal: { title: 'Dein Hauptziel', subtitle: 'Damit passen wir dein Kalorienziel an.' },
  macros: { title: 'Makro-Verteilung', subtitle: 'Wie sollen sich deine Kalorien auf Protein, Carbs und Fett verteilen?' },
  focus: { title: 'Mikronährstoff-Fokus', subtitle: 'Möchtest du bestimmte Nährstoffe besonders im Blick behalten?' },
};

export interface OnboardingWizardResult {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  macroRatioPreset: MacroRatioPreset;
  customMacroRatio?: { protein: number; carbs: number; fat: number };
  micronutrientFocus: MicronutrientFocus;
}

interface OnboardingWizardProps {
  initialName: string;
  onFinish: (input: OnboardingWizardResult) => void;
}

export function OnboardingWizard({ initialName, onFinish }: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];

  const [name, setName] = useState(initialName);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [macroPreset, setMacroPreset] = useState<MacroRatioPreset>('balanced');
  const [customProtein, setCustomProtein] = useState('30');
  const [customCarbs, setCustomCarbs] = useState('40');
  const [customFat, setCustomFat] = useState('30');
  const [focus, setFocus] = useState<MicronutrientFocus>('none');

  const parsedAge = Number.parseInt(age, 10);
  const parsedHeight = Number.parseFloat(heightCm.replace(',', '.'));
  const parsedWeight = Number.parseFloat(weightKg.replace(',', '.'));
  const parsedGoalWeight = Number.parseFloat(goalWeightKg.replace(',', '.'));
  const isBasicsValid =
    name.trim().length > 0 &&
    Number.isFinite(parsedAge) &&
    parsedAge > 0 &&
    Number.isFinite(parsedHeight) &&
    parsedHeight > 0 &&
    Number.isFinite(parsedWeight) &&
    parsedWeight > 0;

  const parsedCustomProtein = Number.parseFloat(customProtein.replace(',', '.'));
  const parsedCustomCarbs = Number.parseFloat(customCarbs.replace(',', '.'));
  const parsedCustomFat = Number.parseFloat(customFat.replace(',', '.'));
  const customSum = (parsedCustomProtein || 0) + (parsedCustomCarbs || 0) + (parsedCustomFat || 0);
  const isCustomRatioValid = macroPreset !== 'custom' || (Number.isFinite(customSum) && Math.abs(customSum - 100) <= 2);

  const isStepValid = step === 'basics' ? isBasicsValid : step === 'macros' ? isCustomRatioValid : true;

  const preview = useMemo(() => {
    if (!isBasicsValid) return null;
    const bmr = calculateBMR({ age: parsedAge, gender, weightKg: parsedWeight, heightCm: parsedHeight });
    const tdee = calculateTDEE(bmr, activityLevel);
    const calories = calculateDailyTargets(tdee, goal);
    const ratio =
      macroPreset === 'custom'
        ? { protein: (parsedCustomProtein || 0) / 100, carbs: (parsedCustomCarbs || 0) / 100, fat: (parsedCustomFat || 0) / 100 }
        : MACRO_RATIO_PRESET_VALUES[macroPreset];
    const macros = calculateMacros(calories, ratio);
    return { calories, macros };
  }, [isBasicsValid, parsedAge, gender, parsedWeight, parsedHeight, activityLevel, goal, macroPreset, parsedCustomProtein, parsedCustomCarbs, parsedCustomFat]);

  function handleBack() {
    if (stepIndex === 0) return;
    setStepIndex((index) => index - 1);
  }

  function handleFinish() {
    if (!isBasicsValid || !isCustomRatioValid) return;
    onFinish({
      name: name.trim(),
      age: parsedAge,
      gender,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      goalWeightKg: Number.isFinite(parsedGoalWeight) && parsedGoalWeight > 0 ? parsedGoalWeight : undefined,
      activityLevel,
      goal,
      macroRatioPreset: macroPreset,
      customMacroRatio:
        macroPreset === 'custom'
          ? { protein: (parsedCustomProtein || 0) / 100, carbs: (parsedCustomCarbs || 0) / 100, fat: (parsedCustomFat || 0) / 100 }
          : undefined,
      micronutrientFocus: focus,
    });
  }

  function handleNext() {
    if (!isStepValid) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((index) => index + 1);
      return;
    }
    handleFinish();
  }

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="items-center gap-4">
            <View className="h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-500 shadow-lg shadow-emerald-500/30">
              <Sparkles color="#ffffff" size={32} />
            </View>
            <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Coach imi</Text>
            <View className="flex-row gap-2">
              {STEPS.map((s, index) => (
                <View
                  key={s}
                  className={`h-1.5 w-8 rounded-full ${index <= stepIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                />
              ))}
            </View>
          </View>

          <Card className="gap-4">
            <View className="items-center gap-1">
              <Text className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{STEP_TITLES[step].title}</Text>
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{STEP_TITLES[step].subtitle}</Text>
            </View>

            {step === 'basics' && (
              <>
                <TextField label="Name" placeholder="Max Mustermann" value={name} onChangeText={setName} autoCapitalize="words" />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TextField label="Alter" keyboardType="number-pad" value={age} onChangeText={setAge} suffix="Jahre" />
                  </View>
                  <View className="flex-1">
                    <TextField label="Größe" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} suffix="cm" />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TextField label="Aktuelles Gewicht" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} suffix="kg" />
                  </View>
                  <View className="flex-1">
                    <TextField label="Zielgewicht (optional)" keyboardType="decimal-pad" value={goalWeightKg} onChangeText={setGoalWeightKg} suffix="kg" />
                  </View>
                </View>
                <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Geschlecht</Text>
                <ChipGroup options={GENDER_OPTIONS} selected={gender} onSelect={setGender} />
              </>
            )}

            {step === 'activity' && <ChipGroup options={ACTIVITY_OPTIONS} selected={activityLevel} onSelect={setActivityLevel} />}

            {step === 'goal' && <ChipGroup options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />}

            {step === 'macros' && (
              <>
                <ChipGroup options={MACRO_RATIO_OPTIONS} selected={macroPreset} onSelect={setMacroPreset} />
                {macroPreset === 'custom' && (
                  <>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <TextField label="Protein" keyboardType="number-pad" value={customProtein} onChangeText={setCustomProtein} suffix="%" />
                      </View>
                      <View className="flex-1">
                        <TextField label="Carbs" keyboardType="number-pad" value={customCarbs} onChangeText={setCustomCarbs} suffix="%" />
                      </View>
                      <View className="flex-1">
                        <TextField label="Fett" keyboardType="number-pad" value={customFat} onChangeText={setCustomFat} suffix="%" />
                      </View>
                    </View>
                    {!isCustomRatioValid && <Text className="text-xs text-red-500">Die drei Werte müssen zusammen ca. 100% ergeben.</Text>}
                  </>
                )}
                {preview && (
                  <View className="gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <Text className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Dein voraussichtliches Tagesziel</Text>
                    <Text className="text-sm text-slate-700 dark:text-slate-200">
                      {preview.calories} kcal · {preview.macros.protein}g Protein · {preview.macros.carbs}g Carbs · {preview.macros.fat}g Fett
                    </Text>
                  </View>
                )}
              </>
            )}

            {step === 'focus' && <ChipGroup options={MICRONUTRIENT_FOCUS_OPTIONS} selected={focus} onSelect={setFocus} />}
          </Card>

          <View className="flex-row gap-3">
            {stepIndex > 0 && (
              <Pressable
                onPress={handleBack}
                className="h-[54px] w-[54px] items-center justify-center rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
              >
                <ChevronLeft color="#64748b" size={20} />
              </Pressable>
            )}
            <Button
              label={stepIndex < STEPS.length - 1 ? 'Weiter' : "Los geht's"}
              onPress={handleNext}
              disabled={!isStepValid}
              className="flex-1"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
