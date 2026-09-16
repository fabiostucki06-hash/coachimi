import { CalendarSync } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CycleManagerBody } from '@/components/features/CycleManagerModal';

export default function CyclesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pt-4 pb-32 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10 lg:pb-12">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <CalendarSync color="#6366F1" size={18} />
          </View>
          <Text className="text-3xl font-bold tracking-tight text-foreground">Diät-Zyklen</Text>
        </View>

        <CycleManagerBody />
      </ScrollView>
    </SafeAreaView>
  );
}
