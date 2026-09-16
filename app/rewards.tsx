import { router } from 'expo-router';
import { Check, Coins, Flame, Lock, Shield, ShieldCheck, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMealIcon } from '@/components/features/mealMeta';
import { type PendingPurchase, PurchaseConfirmModal } from '@/components/features/PurchaseConfirmModal';
import { AVATAR_FRAME_CLASSES } from '@/components/features/UserAvatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCoinsStore } from '@/store/coinsStore';
import { BORDERS, ICON_PACKS, MAX_STREAK_SAVERS, RANKS, SHOP_ITEMS, STREAK_SAVER_COST, useRewardStore } from '@/store/rewardStore';
import { useToastStore } from '@/store/toastStore';
import type { RewardTransaction } from '@/types';

function formatTransactionDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function TransactionRow({ transaction }: { transaction: RewardTransaction }) {
  const isPositive = transaction.amount > 0;
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-1 pr-3">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {transaction.reason}
        </Text>
        <Text className="text-xs text-text-secondary">{formatTransactionDate(transaction.date)}</Text>
      </View>
      <Text className={`text-sm font-bold ${isPositive ? 'text-primary' : 'text-text-secondary'}`}>
        {isPositive ? '+' : ''}
        {transaction.amount} 🪙
      </Text>
    </View>
  );
}

interface CatalogCardProps {
  name: string;
  description: string;
  cost: number;
  equippable: boolean;
  isOwned: boolean;
  isActive: boolean;
  affordable: boolean;
  preview?: ReactNode;
  onBuy: () => void;
  onEquip?: () => void;
  ownedActionLabel?: string;
  onOwnedAction?: () => void;
}

/** One shop entry - covers every catalog (Themes, Badges, Icon Packs, Borders, Ränge, Perks) with the same four states: Ausgerüstet / Freigeschaltet / Gesperrt / [X] Coins. */
function CatalogCard({
  name,
  description,
  cost,
  equippable,
  isOwned,
  isActive,
  affordable,
  preview,
  onBuy,
  onEquip,
  ownedActionLabel,
  onOwnedAction,
}: CatalogCardProps) {
  const equipped = equippable && isActive;
  const purchasedOnly = isOwned && !equipped;

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-3.5">
      <View
        className={`h-10 w-10 items-center justify-center overflow-hidden rounded-full ${
          equipped ? 'bg-primary/15' : isOwned ? 'bg-overlay/5' : affordable ? 'bg-amber-400/15' : 'bg-overlay/5'
        }`}
      >
        {preview ?? (isOwned ? <Check color={equipped ? '#818CF8' : '#A1A1AA'} size={18} /> : <Lock color={affordable ? '#d97706' : '#52525b'} size={16} />)}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{name}</Text>
        <Text className="text-xs text-text-secondary" numberOfLines={2}>
          {description}
        </Text>
      </View>
      {equipped ? (
        <Text className="text-xs font-semibold text-primary">Ausgerüstet</Text>
      ) : purchasedOnly ? (
        equippable ? (
          <Pressable
            onPress={onEquip}
            accessibilityLabel={`${name} ausrüsten`}
            className="rounded-full bg-overlay/5 px-3 py-2 active:opacity-80"
          >
            <Text className="text-xs font-bold text-text-secondary">Ausrüsten</Text>
          </Pressable>
        ) : ownedActionLabel && onOwnedAction ? (
          <Pressable onPress={onOwnedAction} className="rounded-full bg-primary/15 px-3 py-2 active:opacity-80">
            <Text className="text-xs font-bold text-primary">{ownedActionLabel}</Text>
          </Pressable>
        ) : (
          <Text className="text-xs font-semibold text-primary">Freigeschaltet</Text>
        )
      ) : (
        <Pressable
          disabled={!affordable}
          onPress={onBuy}
          accessibilityLabel={`${name} kaufen`}
          className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${affordable ? 'bg-amber-400 active:opacity-80' : 'bg-overlay/5'}`}
        >
          <Text className="text-xs">🪙</Text>
          <Text className={`text-xs font-bold ${affordable ? 'text-amber-950' : 'text-text-secondary'}`}>{cost}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-1">
      <Text className="pb-1 text-sm font-semibold text-text-secondary">{title}</Text>
      <View className="gap-2">{children}</View>
    </Card>
  );
}

export default function RewardsScreen() {
  const goldBars = useCoinsStore((state) => state.coins) ?? 0;
  const streak = useRewardStore((state) => state.streak);
  const streakSavers = useRewardStore((state) => state.streakSavers);
  const activeRank = useRewardStore((state) => state.activeRank);
  const unlockedRanks = useRewardStore((state) => state.unlockedRanks);
  const unlockedBadges = useRewardStore((state) => state.unlockedBadges);
  const activeIconPack = useRewardStore((state) => state.activeIconPack);
  const unlockedIconPacks = useRewardStore((state) => state.unlockedIconPacks);
  const activeBorder = useRewardStore((state) => state.activeBorder);
  const unlockedBorders = useRewardStore((state) => state.unlockedBorders);
  const transactionHistory = useRewardStore((state) => state.transactionHistory);

  const claimDailyReward = useRewardStore((state) => state.claimDailyReward);
  const unlockBadge = useRewardStore((state) => state.unlockBadge);
  const buyStreakSaver = useRewardStore((state) => state.buyStreakSaver);
  const buyRank = useRewardStore((state) => state.buyRank);
  const buyIconPack = useRewardStore((state) => state.buyIconPack);
  const buyBorder = useRewardStore((state) => state.buyBorder);
  const showToast = useToastStore((state) => state.show);

  const [pendingPurchase, setPendingPurchase] = useState<(PendingPurchase & { execute: () => Promise<boolean> }) | null>(null);

  function requestPurchase(name: string, description: string, cost: number, execute: () => Promise<boolean>) {
    setPendingPurchase({ name, description, cost, execute });
  }

  async function confirmPurchase() {
    if (!pendingPurchase) return;
    const succeeded = await pendingPurchase.execute();
    if (!succeeded) showToast('Nicht genug Goldbarren.', 'error');
    setPendingPurchase(null);
  }

  function handleClaim() {
    const claimed = claimDailyReward();
    if (!claimed) {
      showToast('Heute noch nichts geloggt oder Belohnung bereits abgeholt.', 'error');
    }
  }

  function handleBuyStreakSaver() {
    if (streakSavers >= MAX_STREAK_SAVERS) {
      showToast('Maximale Anzahl an Schutzschilden erreicht.', 'error');
      return;
    }
    requestPurchase('Streak-Repair', 'Rettet deinen Streak automatisch bei einem verpassten Tag.', STREAK_SAVER_COST, buyStreakSaver);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-foreground">Münz-Shop</Text>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-overlay/5 backdrop-blur-md active:scale-95 active:opacity-80"
          onPress={() => router.back()}
        >
          <X color="#A1A1AA" size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 pt-4 pb-12">
        <View className="flex-row gap-3">
          <Card className="flex-1 items-center gap-1.5 py-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-400/15">
              <Coins color="#d97706" size={20} />
            </View>
            <Text className="text-2xl font-bold tracking-tight text-foreground">{goldBars}</Text>
            <Text className="text-xs text-text-secondary">Goldbarren</Text>
          </Card>
          <Card className="flex-1 items-center gap-1.5 py-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-400/15">
              <Flame color="#f97316" size={20} />
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-2xl font-bold tracking-tight text-foreground">{streak}</Text>
              {streakSavers > 0 && <ShieldCheck color="#38bdf8" size={16} />}
            </View>
            <Text className="text-xs text-text-secondary">Tage-Streak</Text>
          </Card>
        </View>

        <Button label="Tägliche Belohnung abholen (+5 🪙)" onPress={handleClaim} />

        <SectionCard title="Power-Ups">
          <View className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-sky-400/15">
              <Shield color="#0ea5e9" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">
                Streak-Repair · {streakSavers} / {MAX_STREAK_SAVERS}
              </Text>
              <Text className="text-xs text-text-secondary">Rettet deinen Streak automatisch bei einem verpassten Tag.</Text>
            </View>
            <Pressable
              disabled={streakSavers >= MAX_STREAK_SAVERS || goldBars < STREAK_SAVER_COST}
              onPress={handleBuyStreakSaver}
              className={`flex-row items-center gap-1 rounded-full px-3 py-2 ${
                streakSavers >= MAX_STREAK_SAVERS || goldBars < STREAK_SAVER_COST ? 'bg-overlay/5' : 'bg-amber-400 active:opacity-80'
              }`}
            >
              <Text className="text-xs">🪙</Text>
              <Text
                className={`text-xs font-bold ${
                  streakSavers >= MAX_STREAK_SAVERS || goldBars < STREAK_SAVER_COST ? 'text-text-secondary' : 'text-amber-950'
                }`}
              >
                {STREAK_SAVER_COST}
              </Text>
            </Pressable>
          </View>

          {ICON_PACKS.filter((pack) => pack.cost > 0).map((pack) => {
            const Icon = getMealIcon('breakfast', pack.id);
            const isOwned = unlockedIconPacks.includes(pack.id);
            return (
              <CatalogCard
                key={pack.id}
                name={pack.name}
                description={pack.description}
                cost={pack.cost}
                equippable
                isOwned={isOwned}
                isActive={activeIconPack === pack.id}
                affordable={goldBars >= pack.cost}
                preview={<Icon color={isOwned ? '#A1A1AA' : '#d97706'} size={18} />}
                onBuy={() => requestPurchase(pack.name, `Mahlzeiten-Icon-Pack: ${pack.description}`, pack.cost, () => buyIconPack(pack.id))}
                onEquip={() => buyIconPack(pack.id)}
              />
            );
          })}

        </SectionCard>

        <SectionCard title="Avatar Frames">
          {BORDERS.filter((border) => border.cost > 0).map((border) => {
            const isOwned = unlockedBorders.includes(border.id);
            return (
              <CatalogCard
                key={border.id}
                name={border.name}
                description={border.description}
                cost={border.cost}
                equippable
                isOwned={isOwned}
                isActive={activeBorder === border.id}
                affordable={goldBars >= border.cost}
                preview={<View className={`h-6 w-6 rounded-full border-surface-border ${AVATAR_FRAME_CLASSES[border.id]}`} />}
                onBuy={() => requestPurchase(border.name, `Avatar Frame: ${border.description}`, border.cost, () => buyBorder(border.id))}
                onEquip={() => buyBorder(border.id)}
              />
            );
          })}
        </SectionCard>

        <SectionCard title="Visual Customizations · Profil-Badges">
          {SHOP_ITEMS.map((item) => {
            const isOwned = unlockedBadges.includes(item.id);
            return (
              <CatalogCard
                key={item.id}
                name={item.name}
                description={item.description}
                cost={item.cost}
                equippable={false}
                isOwned={isOwned}
                isActive={false}
                affordable={goldBars >= item.cost}
                onBuy={() => requestPurchase(item.name, item.description, item.cost, () => unlockBadge(item.id))}
              />
            );
          })}
        </SectionCard>

        <SectionCard title="Ränge &amp; Titel">
          {RANKS.map((rank) => {
            const isOwned = unlockedRanks.includes(rank.id);
            return (
              <CatalogCard
                key={rank.id}
                name={rank.name}
                description="Profiltitel"
                cost={rank.cost}
                equippable
                isOwned={isOwned}
                isActive={activeRank === rank.id}
                affordable={goldBars >= rank.cost}
                onBuy={() => requestPurchase(rank.name, 'Neuer Profil-Rang', rank.cost, () => buyRank(rank.id))}
                onEquip={() => buyRank(rank.id)}
              />
            );
          })}
        </SectionCard>

        <Card className="gap-1">
          <Text className="pb-1 text-sm font-semibold text-text-secondary">Verlauf</Text>
          {transactionHistory.length === 0 ? (
            <Text className="py-2 text-sm text-text-secondary">Noch keine Goldbarren verdient.</Text>
          ) : (
            <View className="divide-y divide-surface-border">
              {transactionHistory.slice(0, 15).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      <PurchaseConfirmModal purchase={pendingPurchase} goldBars={goldBars} onConfirm={confirmPurchase} onCancel={() => setPendingPurchase(null)} />
    </SafeAreaView>
  );
}
