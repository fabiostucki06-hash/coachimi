import { Redirect, router } from 'expo-router';

import { OnboardingWizard, type OnboardingWizardResult } from '@/components/features/OnboardingWizard';
import { pushSnapshot } from '@/services/cloudSync';
import { useSyncStore } from '@/store/syncStore';
import { useUserStore } from '@/store/userStore';

export default function SetupScreen() {
  const hasOnboarded = useUserStore((state) => state.hasOnboarded);
  const user = useUserStore((state) => state.user);
  const updateAccount = useUserStore((state) => state.updateAccount);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const setMicronutrientFocus = useUserStore((state) => state.setMicronutrientFocus);
  const finishOnboarding = useUserStore((state) => state.finishOnboarding);

  if (hasOnboarded) return <Redirect href="/(tabs)" />;

  async function handleFinish(input: OnboardingWizardResult) {
    updateAccount({ name: input.name, email: user.email });
    updateProfile({
      age: input.age,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      goalWeightKg: input.goalWeightKg,
      activityLevel: input.activityLevel,
      goal: input.goal,
      dietType: input.dietType,
      macroRatioPreset: input.macroRatioPreset,
      customMacroRatio: input.customMacroRatio,
    });
    setMicronutrientFocus(input.micronutrientFocus);
    finishOnboarding();

    // Give the push a real chance to land before navigating away — local state is
    // already safely persisted either way, but this closes most of the window where
    // a refresh right after setup could still result in an empty remote row.
    const session = useSyncStore.getState().session;
    if (session) await pushSnapshot(session.user.id).catch(() => {});

    router.replace('/(tabs)');
  }

  return <OnboardingWizard initialName={user.name} onFinish={handleFinish} />;
}
