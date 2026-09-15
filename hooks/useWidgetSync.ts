import { useEffect } from 'react';

import { notifyDataChanged } from '@/hooks/useServiceWorker';
import { syncWidgetData } from '@/services/widgetBridge';
import { useCoinsStore } from '@/store/coinsStore';
import { todayKey, useDiaryStore } from '@/store/diaryStore';
import { useRewardStore } from '@/store/rewardStore';
import { useUserStore } from '@/store/userStore';

function pushWidgetSnapshot() {
  const date = todayKey();
  const entries = useDiaryStore.getState().entriesByDate[date] ?? [];
  const consumedCalories = entries.reduce((sum, entry) => sum + entry.foodItem.caloriesPerServing * entry.servings, 0);
  const consumedProtein = entries.reduce((sum, entry) => sum + entry.foodItem.macrosPerServing.protein * entry.servings, 0);
  const { dailyCalorieGoal, dailyMacroGoal } = useUserStore.getState().user;
  const { streak } = useRewardStore.getState();
  const goldBars = useCoinsStore.getState().coins ?? 0;

  void syncWidgetData({
    remainingKcal: Math.max(dailyCalorieGoal - consumedCalories, 0),
    targetKcal: dailyCalorieGoal,
    remainingProtein: Math.max(dailyMacroGoal.protein - consumedProtein, 0),
    goldBars,
    streak,
  });
  notifyDataChanged();
}

/**
 * Keeps the widget bridge current by re-syncing on every diaryStore/rewardStore
 * change (a meal logged/removed, gold bars earned or spent, streak advanced).
 *
 * This deliberately subscribes from outside diaryStore/rewardStore instead of
 * calling syncWidgetData() from inside their own action functions: diaryStore
 * is also written to directly via setState on the signed-in sync path (see
 * services/diaryActions.ts), which action-level hooks would miss, and having
 * diaryStore and rewardStore each import the other to read cross-store totals
 * would create a circular module dependency. Call once from the app root.
 */
export function useWidgetSync() {
  useEffect(() => {
    pushWidgetSnapshot();

    const unsubscribeDiary = useDiaryStore.subscribe((state, prev) => {
      if (state.entriesByDate !== prev.entriesByDate) pushWidgetSnapshot();
    });
    const unsubscribeReward = useRewardStore.subscribe((state, prev) => {
      if (state.streak !== prev.streak) pushWidgetSnapshot();
    });
    const unsubscribeCoins = useCoinsStore.subscribe((state, prev) => {
      if (state.coins !== prev.coins) pushWidgetSnapshot();
    });
    const unsubscribeUser = useUserStore.subscribe((state, prev) => {
      if (state.user.dailyCalorieGoal !== prev.user.dailyCalorieGoal || state.user.dailyMacroGoal !== prev.user.dailyMacroGoal) {
        pushWidgetSnapshot();
      }
    });

    return () => {
      unsubscribeDiary();
      unsubscribeReward();
      unsubscribeCoins();
      unsubscribeUser();
    };
  }, []);
}
