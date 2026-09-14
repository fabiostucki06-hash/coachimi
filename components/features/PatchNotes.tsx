import { ChevronDown, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { RELEASE_NOTES } from '@/data/releaseNotes';

export function PatchNotes() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="gap-1">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center justify-between py-1"
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Patch Notes einklappen' : 'Patch Notes ausklappen'}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <Sparkles color="#A1A1AA" size={18} />
          </View>
          <View>
            <Text className="text-sm font-semibold text-text-secondary">Patch Notes</Text>
            <Text className="text-xs text-text-secondary">Version {RELEASE_NOTES[0]?.version}</Text>
          </View>
        </View>
        <ChevronDown color="#A1A1AA" size={18} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Pressable>

      {expanded && (
        <View className="gap-4 pt-3">
          {RELEASE_NOTES.map((release) => (
            <View key={release.version} className="gap-1.5 border-t border-surface-border pt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-white">Version {release.version}</Text>
                <Text className="text-xs text-text-secondary">{release.date}</Text>
              </View>
              {release.highlights.map((highlight) => (
                <Text key={highlight} className="text-xs leading-5 text-text-secondary">
                  • {highlight}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
