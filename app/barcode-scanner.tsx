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
      const item = await getFoodByBarcode(data);
      setPendingSelection(item, mealType);
      router.replace('/log-quantity');
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
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
    router.replace({ pathname: '/add-food', params: { mealType } });
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-lg font-bold tracking-tight text-white">Barcode scannen</Text>
        <View className="flex-row items-center gap-2">
          {permission?.granted && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-150 ease-in-out active:scale-95 active:opacity-80"
              onPress={() => setTorchOn((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Taschenlampe umschalten"
            >
              {torchOn ? <Zap color="#10b981" size={18} /> : <ZapOff color="#ffffff" size={18} />}
            </Pressable>
          )}
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-150 ease-in-out active:scale-95 active:opacity-80"
            onPress={() => router.back()}
          >
            <X color="#ffffff" size={18} />
          </Pressable>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {!permission ? (
          <ActivityIndicator color="#10b981" />
        ) : !permission.granted ? (
          <View className="items-center gap-4">
            <Text className="text-center text-sm text-white/80">
              Kamera-Zugriff wird benötigt, um Barcodes zu scannen.
            </Text>
            <Button label="Zugriff erlauben" onPress={requestPermission} />
          </View>
        ) : (
          <View className="aspect-square w-full overflow-hidden rounded-[28px] border border-white/20">
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
                  code inside this rectangle gives the fastest, most reliable focus/detection in practice. */}
              <View className="flex-1 items-center justify-center">
                <View className="h-[160px] w-[280px] rounded-2xl border-2 border-emerald-400/90" />
              </View>
            </CameraView>
          </View>
        )}

        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/50 backdrop-blur-md">
            <ActivityIndicator color="#10b981" size="large" />
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
          <View className="gap-4 rounded-t-[28px] border-t border-white/10 bg-slate-900 px-6 pb-10 pt-6">
            <View className="items-center gap-1">
              <Text className="text-base font-semibold text-white">Produkt nicht gefunden</Text>
              <Text className="text-center text-sm text-white/60">
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
