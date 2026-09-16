import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X, Zap, ZapOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FoodApiError, ProductNotFoundError, getFoodByBarcode } from '@/services/foodApi';
import { useUiStore } from '@/store/uiStore';
import type { MealType } from '@/types';

/** How long the scanner ignores new detections after a successful read, to avoid duplicate lookups from the same code lingering in frame. */
const SCAN_LOCK_MS = 2000;

export default function BarcodeScannerScreen() {
  const params = useLocalSearchParams<{ mealType: MealType }>();
  const mealType = params.mealType ?? 'breakfast';
  const setPendingSelection = useUiStore((state) => state.setPendingSelection);

  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scannedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
  }, []);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    Vibration.vibrate(100);

    try {
      // Multi-tier lookup (Supabase community cache -> Open Food Facts -> USDA) -
      // see services/foodApi.ts. Only a genuinely empty barcode string throws here;
      // every tier failing just resolves to ProductNotFoundError below.
      const item = await getFoodByBarcode(data);
      setPendingSelection(item, mealType, { fromScan: true });
      router.replace('/log-quantity');
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        setScannedBarcode(data);
        setNotFound(true);
      } else {
        setError(err instanceof FoodApiError ? err.message : 'Produkt konnte nicht geladen werden.');
      }
      setLoading(false);
      unlockTimerRef.current = setTimeout(() => {
        scannedRef.current = false;
      }, SCAN_LOCK_MS);
    }
  }

  function handleRetry() {
    setError(null);
    setNotFound(false);
    scannedRef.current = false;
  }

  function handleManualAdd() {
    router.replace({ pathname: '/add-food', params: { mealType, barcode: scannedBarcode ?? undefined } });
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-foreground">Barcode scannen</Text>
        <View className="flex-row items-center gap-2">
          {permission?.granted && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-overlay/20 bg-overlay/10 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80"
              onPress={() => setTorchOn((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Taschenlampe umschalten"
            >
              {torchOn ? <Zap color="#6366F1" size={18} /> : <ZapOff color="#ffffff" size={18} />}
            </Pressable>
          )}
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full border border-overlay/20 bg-overlay/10 backdrop-blur-md transition-[transform,opacity] duration-150 ease-in-out active:scale-95 active:opacity-80"
            onPress={() => router.back()}
          >
            <X color="#ffffff" size={18} />
          </Pressable>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {!permission ? (
          <ActivityIndicator color="#6366F1" />
        ) : !permission.granted ? (
          <View className="items-center gap-4">
            <Text className="text-center text-sm text-foreground/80">
              Kamera-Zugriff wird benötigt, um Barcodes zu scannen.
            </Text>
            <Button label="Zugriff erlauben" onPress={requestPermission} />
          </View>
        ) : (
          <View className="aspect-square w-full overflow-hidden rounded-[28px] border border-overlay/10">
            <CameraView
              className="flex-1"
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
              }}
              onBarcodeScanned={loading || scannedRef.current ? undefined : handleBarcodeScanned}
            >
              {/* Visual scan-region guide - native barcode detection reads the full frame, but framing the
                  code inside this target gives the fastest, most reliable focus/detection in practice.
                  Thin corner brackets + a subtle crosshair rather than a solid box, to stay minimal on
                  top of the live camera feed. */}
              <View className="flex-1 items-center justify-center">
                <View className="h-[160px] w-[280px]">
                  <View className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l border-t border-primary/80" />
                  <View className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r border-t border-primary/80" />
                  <View className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b border-l border-primary/80" />
                  <View className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b border-r border-primary/80" />
                  <View className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-primary/50" />
                  <View className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/50" />
                </View>
              </View>
            </CameraView>
          </View>
        )}

        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/50 backdrop-blur-md">
            <ActivityIndicator color="#6366F1" size="large" />
          </View>
        )}
      </View>

      {error && (
        <View className="gap-3 px-6 pb-8">
          <Text className="text-center text-sm text-red-400">{error}</Text>
          <Button label="Erneut versuchen" variant="secondary" onPress={handleRetry} />
        </View>
      )}

      {notFound && (
        <>
          <Pressable className="absolute inset-0 bg-black/60" onPress={handleRetry} />
          <View className="gap-4 rounded-t-[28px] border-t border-overlay/10 bg-surface px-6 pb-10 pt-6">
            <View className="items-center gap-1">
              <Text className="text-base font-semibold text-foreground">Produkt nicht gefunden</Text>
              <Text className="text-center text-sm text-foreground/60">
                Möchtest du es manuell anlegen?
              </Text>
            </View>
            <Button label="Manuell anlegen" icon={<Plus color="#ffffff" size={18} />} onPress={handleManualAdd} />
            <Button label="Erneut scannen" variant="secondary" onPress={handleRetry} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
