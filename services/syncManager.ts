import { AppState, Platform } from 'react-native';

import { useOfflineQueueStore } from '@/services/offlineQueue';
import { useSyncStore } from '@/store/syncStore';

let started = false;

/**
 * Drains the offline queue the moment connectivity is back. Deliberately
 * thin: store/syncStore.ts already has a full reconnect-and-retry engine
 * (reconnectSync, triggered by AppState/focus/online) that re-runs syncNow()
 * whenever status is 'error' - which is exactly the state
 * services/diaryActions.ts's pushThenCommit leaves things in after an
 * offline-committed mutation. This module only has to (1) keep the
 * `online` flag in offlineQueue.ts honest for the UI banner, and (2) clear
 * the pending-dates list once that existing retry machinery reports success.
 * No second push/replay loop, no risk of racing the one in syncStore.ts.
 */
export function startSyncManager(): void {
  if (started) return;
  started = true;

  const { setOnline, clearPending } = useOfflineQueueStore.getState();

  if (Platform.OS === 'web') {
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }

  // A successful push proves the connection is back, independent of whether
  // a browser/native event ever fired for it - covers the native case, which
  // has no netinfo dependency in this project to signal reconnects directly.
  useSyncStore.subscribe((state, prevState) => {
    if (state.status === 'synced' && prevState.status !== 'synced') {
      setOnline(true);
      clearPending();
    }
  });
}
