import { router } from 'expo-router';
import { Check, Coins, Flame, Lock, X } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SHOP_ITEMS, useRewardStore } from '@/store/rewardStore';
import { useToastStore } from '@/store/toastStore';
import type { BadgeId, RewardTransaction } from '@/types';

function formatTransactionDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function TransactionRow({ transaction }: { transaction: RewardTransaction }) {
  const isPositive = transaction.amount > 0;
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-1 pr-3">
        <Text className="text-sm text-slate-700 dark:text-slate-200" numberOfLines={1}>
          {transaction.reason}
        </Text>
        <Text className="text-xs text-slate-400">{formatTransactionDate(transaction.date)}</Text>
      </View>
      <Text className={`text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {isPositive ? '+' : ''}
        {transaction.amount} 🪙
      </Text>
    </View>
  );
}

function ShopItemRow({
  item,
  unlocked,
  affordable,
  onUnlock,
}: {
  item: (typeof SHOP_ITEMS)[number];
  unlocked: boolean;
  affordable: boolean;
  onUnlock: (id: BadgeId) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/70 p-3.5 dark:border-slate-800/60 dark:bg-slate-900/60">
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          unlocked ? 'bg-emerald-500/15' : 'bg-amber-400/15'
        }`}
      >
        {unlocked ? <Check color="#10b981" size={18} /> : <Lock color="#d97706" size={16} />}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</Text>
        <Text className="text-xs text-slate-400" numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      {unlocked ? (
        <Text className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Freigeschaltet</Text>
      ) : (
        <Pressable
          disabled={!affordable}
          onPress={() => onUnlock(item.id)}
          className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${
            affordable ? 'bg-amber-400 active:opacity-80' : 'bg-slate-100 dark:bg-white/5'
          }`}
        >
          <Text className="text-xs">🪙</Text>
          <Text className={`text-xs font-bold ${affordable ? 'text-amber-950' : 'text-slate-400'}`}>{item.cost}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function RewardsScreen() {
  const goldBars = useRewardStore((state) => state.goldBars);
  const streak = useRewardStore((state) => state.streak);
  const unlockedBadges = useRewardStore((state) => state.unlockedBadges);
  const transactionHistory = useRewardStore((state) => state.transactionHistory);
  const claimDailyReward = useRewardStore((state) => state.claimDailyReward);
  const unlockBadge = useRewardStore((state) => state.unlockBadge);
  const showToast = useToastStore((state) => state.show);

  function handleClaim() {
    const claimed = claimDailyReward();
    if (!claimed) {
      showToast('Heute noch nichts geloggt oder Belohnung bereits abgeholt.', 'error');
    }
  }

  function handleUnlock(badgeId: BadgeId) {
    const unlocked = unlockBadge(badgeId);
    if (!unlocked) {
      showToast('Nicht genug Goldbarren für dieses Badge.', 'error');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-background-dark">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Belohnungen</Text>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-slate-200/50 bg-slate-100/60 backdrop-blur-md active:scale-95 active:opacity-80 dark:border-slate-800/60 dark:bg-white/5"
          onPress={() => router.back()}
        >
          <X color="#64748b" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pt-4 pb-12">
        <View className="flex-row gap-3">
          <Card className="flex-1 items-center gap-1.5 py-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-400/15">
              <Coins color="#d97706" size={20} />
            </View>
            <Text className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{goldBars}</Text>
            <Text className="text-xs text-slate-400">Goldbarren</Text>
          </Card>
          <Card className="flex-1 items-center gap-1.5 py-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-400/15">
              <Flame color="#f97316" size={20} />
            </View>
            <Text className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{streak}</Text>
            <Text className="text-xs text-slate-400">Tage-Streak</Text>
          </Card>
        </View>

        <Button label="Tägliche Belohnung abholen (+5 🪙)" onPress={handleClaim} />

        <Card className="gap-1">
          <Text className="pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Meilensteine &amp; Shop</Text>
          <View className="gap-2">
            {SHOP_ITEMS.map((item) => (
              <ShopItemRow
                key={item.id}
                item={item}
                unlocked={unlockedBadges.includes(item.id)}
                affordable={goldBars >= item.cost}
                onUnlock={handleUnlock}
              />
            ))}
          </View>
        </Card>

        <Card className="gap-1">
          <Text className="pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Verlauf</Text>
          {transactionHistory.length === 0 ? (
            <Text className="py-2 text-sm text-slate-400">Noch keine Goldbarren verdient.</Text>
          ) : (
            <View className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {transactionHistory.slice(0, 15).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
