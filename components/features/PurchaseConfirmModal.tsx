import { Coins } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';

export interface PendingPurchase {
  name: string;
  description: string;
  cost: number;
}

interface PurchaseConfirmModalProps {
  purchase: PendingPurchase | null;
  goldBars: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bottom-sheet confirmation shown before any Coin Shop spend - required so a purchase always needs a deliberate second tap, never a single accidental one. */
export function PurchaseConfirmModal({ purchase, goldBars, onConfirm, onCancel }: PurchaseConfirmModalProps) {
  return (
    <Modal visible={purchase !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onCancel}>
        <Pressable className="w-full max-w-sm gap-4 rounded-[28px] border border-surface-border bg-background p-6" onPress={(e) => e.stopPropagation()}>
          {purchase && (
            <>
              <View className="items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-400/15">
                  <Coins color="#d97706" size={22} />
                </View>
                <View className="items-center gap-1">
                  <Text className="text-base font-bold tracking-tight text-white">{purchase.name}</Text>
                  <Text className="text-center text-xs text-text-secondary">{purchase.description}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface p-3.5">
                <Text className="text-xs text-text-secondary">Kosten</Text>
                <View className="flex-row items-center gap-1">
                  <Text className="text-xs">🪙</Text>
                  <Text className="text-sm font-bold text-amber-400">{purchase.cost}</Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-xs text-text-secondary">Guthaben danach</Text>
                <Text className="text-xs font-semibold text-text-secondary">{goldBars - purchase.cost} 🪙</Text>
              </View>

              <View className="flex-row gap-3 pt-1">
                <Button label="Abbrechen" variant="secondary" onPress={onCancel} className="flex-1" />
                <Button label="Kaufen" variant="primary" onPress={onConfirm} className="flex-1" />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
