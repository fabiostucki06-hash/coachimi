import { HeartPulse, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getHealthAdvice, type AdvisorTip } from '@/utils/healthAdvisor';

export function HealthAdvisor() {
  const [text, setText] = useState('');
  const [tips, setTips] = useState<AdvisorTip[] | null>(null);

  function handleAsk() {
    if (!text.trim()) return;
    setTips(getHealthAdvice(text.trim()));
  }

  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-overlay/5 ">
          <HeartPulse color="#A1A1AA" size={18} />
        </View>
        <Text className="text-sm font-semibold text-text-secondary">Dein KI-Gesundheitscoach</Text>
      </View>

      <TextInput
        className="min-h-[70px] rounded-2xl border border-surface-border bg-overlay/5 px-4 py-3 text-sm text-foreground"
        placeholder="z. B. 'Wie reduziere ich Muskelkater?' oder 'Tipps für mehr Energie am Morgen'"
        placeholderTextColor="#A1A1AA"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setTips(null);
        }}
        multiline
        textAlignVertical="top"
      />

      <Button label="Tipps anfordern" icon={<Sparkles color="#ffffff" size={16} />} onPress={handleAsk} disabled={!text.trim()} />

      {tips && (
        <View className="gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          {tips.map((tip, index) => (
            <Text key={tip.id} className="text-xs leading-5 text-primary">
              {index + 1}. {tip.step}
            </Text>
          ))}
        </View>
      )}

      <Text className="text-center text-[10px] text-text-secondary">
        Hinweis: Ersetzt keine medizinische Beratung.
      </Text>
    </Card>
  );
}
