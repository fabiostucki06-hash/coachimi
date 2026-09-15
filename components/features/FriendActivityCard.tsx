import { Dumbbell } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { UserAvatar } from '@/components/features/UserAvatar';
import { Card } from '@/components/ui/Card';
import { formatFriendLabel, type FriendActivitySummary, type FriendProfile } from '@/services/friends';

function shortName(profile: FriendProfile): string {
  return profile.name?.trim() || profile.username?.trim() || profile.email;
}

/** One friend's today-summary row for the activity feed - "hat heute Xg Protein erreicht & ein Y-Workout absolviert", derived from their synced snapshot (services/friends.ts fetchFriendActivity). */
export function FriendActivityCard({ profile, activity }: { profile: FriendProfile; activity: FriendActivitySummary | undefined }) {
  const name = shortName(profile);
  const proteinG = activity?.proteinG ?? 0;
  const hasLoggedFood = proteinG > 0 || (activity?.calories ?? 0) > 0;
  const workoutNames = activity?.completedWorkoutNames ?? [];

  const sentenceParts: string[] = [];
  if (hasLoggedFood) sentenceParts.push(`heute ${proteinG}g Protein erreicht`);
  if (workoutNames.length > 0) sentenceParts.push(`ein ${workoutNames[0]}-Workout absolviert`);
  const sentence = sentenceParts.length > 0 ? `${name} hat ${sentenceParts.join(' & ')}.` : `${name} hat heute noch nichts geloggt.`;

  return (
    <Card className="flex-row items-center gap-3">
      <UserAvatar name={name} avatarUrl={activity?.avatarUrl} frameId={activity?.activeBorder ?? 'none'} size={44} />
      <View className="flex-1 gap-1">
        <Text className="text-xs font-semibold text-text-secondary">{formatFriendLabel(profile)}</Text>
        <Text className="text-sm text-white">{sentence}</Text>
        {activity && (activity.calorieGoal > 0 || activity.proteinGoalG > 0) ? (
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-text-secondary">
              {activity.calories}/{activity.calorieGoal} kcal
            </Text>
            <Text className="text-xs text-text-secondary">
              {activity.proteinG}/{activity.proteinGoalG}g Protein
            </Text>
          </View>
        ) : null}
      </View>
      {workoutNames.length > 0 ? <Dumbbell color="#6366F1" size={18} /> : null}
    </Card>
  );
}
