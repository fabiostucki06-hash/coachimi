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
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100/70 dark:bg-white/5">
          <HeartPulse color="#64748b" size={18} />
        </View>
        <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">Dein KI-Gesundheitscoach</Text>
      </View>

      <TextInput
        className="min-h-[70px] rounded-2xl border border-slate-200/70 bg-[#EDF2F7] px-4 py-3 text-sm text-slate-900 dark:border-slate-800/60 dark:bg-white/5 dark:text-white"
        placeholder="z. B. 'Wie reduziere ich Muskelkater?' oder 'Tipps für mehr Energie am Morgen'"
        placeholderTextColor="#94a3b8"
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
        <View className="gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          {tips.map((tip, index) => (
            <Text key={tip.id} className="text-xs leading-5 text-emerald-700 dark:text-emerald-400">
              {index + 1}. {tip.step}
            </Text>
          ))}
        </View>
      )}

      <Text className="text-center text-[10px] text-slate-400 dark:text-slate-500">
        Hinweis: Ersetzt keine medizinische Beratung.
      </Text>
    </Card>
  );
}
