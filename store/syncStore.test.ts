jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let authCallback: ((event: string, session: unknown) => void) | undefined;
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
// Backs store/coinsStore.ts's add_coins/spend_coins RPC calls - the coin
// balance is backend-driven (supabase/migrations/0004_backend_coins.sql), no
// longer part of the user_data JSONB snapshot these tests otherwise mock.
const mockRpc = jest.fn().mockResolvedValue({ data: 0, error: null });
const mockRefreshSession = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
      },
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
    // The table name is forwarded so a test can answer user_data reads
    // differently from the profiles.coins read that fires alongside them.
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle(table) }) }),
      upsert: mockUpsert,
    }),
    // Wrapped (not `rpc: mockRpc` directly): this property sits on the
    // factory's top-level return value, which babel's hoisted require()
    // evaluates before `const mockRpc = ...` below has run - assigning the
    // not-yet-initialized value directly would freeze `rpc` as undefined.
    // `from`/`upsert` above dodge this because they're read lazily from
    // inside nested functions, invoked well after mockUpsert/mockMaybeSingle
    // are assigned.
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCoinsStore } from '@/store/coinsStore';
import { useRewardStore } from '@/store/rewardStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useUserStore } from '@/store/userStore';
import { useSyncStore } from '@/store/syncStore';

function flush() {
  return new Promise<void>((resolve) => setImmediate(() => resolve()));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useUserStore.setState((state) => ({ user: { ...state.user, dailyCalorieGoal: 1800 } }));
  useRewardStore.setState({ streak: 0, streakSavers: 0, activeRank: 'neuling', unlockedRanks: ['neuling'] });
  useTrainingStore.setState({ templates: [], sessionsByDate: {} });
  useCoinsStore.getState().reset();
  mockUpsert.mockClear();
  mockRpc.mockClear();
});

function remoteRowAt(dailyCalorieGoal: number, updatedAt: string) {
  const { user, weightHistory } = useUserStore.getState();
  return {
    data: { user: { ...user, dailyCalorieGoal }, weightHistory, entriesByDate: {}, hasOnboarded: true },
    updated_at: updatedAt,
  };
}

// Regression: a hard refresh shortly after a local edit (before the debounced
// auto-sync push lands) used to lose that edit — the reload re-runs
// onAuthStateChange's INITIAL_SESSION, which unconditionally pulled whatever
// stale snapshot was already in Supabase and overwrote the fresher local
// state that zustand's persist middleware had already saved to localStorage.
it('does not let a stale remote snapshot clobber a newer local edit on reload', async () => {
  const oldTimestamp = new Date(Date.now() - 60_000).toISOString();

  // Boot #1: remote and local already in sync.
  mockMaybeSingle.mockResolvedValue({ data: remoteRowAt(1800, oldTimestamp), error: null });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u1' }, access_token: 'tok-1' });
  await flush();
  await flush();
  expect(useUserStore.getState().user.dailyCalorieGoal).toBe(1800);

  // A local edit happens, but the debounced push to Supabase hasn't landed yet.
  useUserStore.getState().updateGoals({ dailyCalorieGoal: 2500, dailyMacroGoal: { carbs: 300, protein: 180, fat: 80 } });
  await flush();

  // Simulate a hard refresh: a fresh INITIAL_SESSION fires and pulls the same
  // stale (pre-edit) remote row, since the push never got a chance to run.
  authCallback?.('INITIAL_SESSION', { user: { id: 'u1' }, access_token: 'tok-2' });
  await flush();
  await flush();

  expect(useUserStore.getState().user.dailyCalorieGoal).toBe(2500);
});

it('still applies a genuinely newer remote snapshot (e.g. edited on another device)', async () => {
  const oldTimestamp = new Date(Date.now() - 60_000).toISOString();

  mockMaybeSingle.mockResolvedValue({ data: remoteRowAt(1800, oldTimestamp), error: null });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u2' }, access_token: 'tok-3' });
  await flush();
  await flush();
  expect(useUserStore.getState().user.dailyCalorieGoal).toBe(1800);

  // Another device pushes a newer edit after this device's last local change.
  const newerTimestamp = new Date(Date.now() + 60_000).toISOString();
  mockMaybeSingle.mockResolvedValue({ data: remoteRowAt(3000, newerTimestamp), error: null });
  authCallback?.('INITIAL_SESSION', { user: { id: 'u2' }, access_token: 'tok-4' });
  await flush();
  await flush();

  expect(useUserStore.getState().user.dailyCalorieGoal).toBe(3000);
});

it('credits coins via the add_coins RPC, not the synced JSONB snapshot', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u3' }, access_token: 'tok-5' });
  await flush();
  await flush();

  useRewardStore.getState().addGoldBars(5, 'Testguthaben');
  expect(mockRpc).toHaveBeenCalledWith('add_coins', { p_amount: 5 });

  // Auto-sync push is debounced by 200ms - advance past it. The reward store
  // still pushes its own change (transaction history/celebration), but the
  // coin balance itself must never be part of that payload - see
  // supabase/migrations/0004_backend_coins.sql.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await flush();

  expect(mockUpsert).toHaveBeenCalled();
  const pushedRow = mockUpsert.mock.calls[mockUpsert.mock.calls.length - 1][0];
  expect(pushedRow.data.rewards.goldBars).toBeUndefined();
});

it('applies a pulled remote reward snapshot to the reward store', async () => {
  const { user, weightHistory } = useUserStore.getState();
  // A clearly-future timestamp, same pattern as the "genuinely newer remote
  // snapshot" test above: makes the assertion robust against any leftover
  // local-change timestamp from an earlier test in this file.
  const newerTimestamp = new Date(Date.now() + 60_000).toISOString();
  mockMaybeSingle.mockResolvedValue({
    data: {
      data: {
        user,
        weightHistory,
        entriesByDate: {},
        hasOnboarded: true,
        rewards: { streak: 3, streakSavers: 2, activeRank: 'gold_standard_athlet', unlockedRanks: ['neuling', 'gold_standard_athlet'] },
      },
      updated_at: newerTimestamp,
    },
    error: null,
  });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u4' }, access_token: 'tok-6' });
  await flush();
  await flush();

  expect(useRewardStore.getState().activeRank).toBe('gold_standard_athlet');
});

it('fetches the coin balance from profiles.coins on session load', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { coins: 17 }, error: null });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u7' }, access_token: 'tok-9' });
  await flush();
  await flush();

  expect(useCoinsStore.getState().coins).toBe(17);
});

// Regression: a finished workout only lived in trainingStore's local
// AsyncStorage persistence and was never included in the Supabase snapshot -
// reinstalling the app or switching devices silently lost all training
// history. Training must push through the same debounced auto-sync as every
// other store.
it('pushes training sessions to Supabase when they change locally', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u5' }, access_token: 'tok-7' });
  await flush();
  await flush();

  useTrainingStore.setState({
    sessionsByDate: {
      '2026-01-01': [
        { id: 's1', templateId: 't1', templateName: 'Push Day', date: '2026-01-01', exercises: [] },
      ],
    },
  });
  // Auto-sync push is debounced by 200ms - advance past it.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await flush();

  expect(mockUpsert).toHaveBeenCalled();
  const pushedRow = mockUpsert.mock.calls[mockUpsert.mock.calls.length - 1][0];
  expect(pushedRow.data.training.sessionsByDate['2026-01-01']).toHaveLength(1);
});

// Regression guard for the rollout of the above: existing users' remote rows
// predate the `training` field entirely. Pulling one of those rows must leave
// the local training store untouched, not wipe it back to empty (the same
// safe-optional-field pattern `rewards` already uses).
it('does not wipe local training data when a pulled remote snapshot predates the training-sync feature', async () => {
  useTrainingStore.setState({
    templates: [],
    sessionsByDate: { '2026-01-02': [{ id: 's2', templateId: 't2', templateName: 'Leg Day', date: '2026-01-02', exercises: [] }] },
  });

  const { user, weightHistory } = useUserStore.getState();
  const newerTimestamp = new Date(Date.now() + 60_000).toISOString();
  mockMaybeSingle.mockResolvedValue({
    data: { data: { user, weightHistory, entriesByDate: {}, hasOnboarded: true }, updated_at: newerTimestamp },
    error: null,
  });
  useSyncStore.getState().init();
  authCallback?.('INITIAL_SESSION', { user: { id: 'u6' }, access_token: 'tok-8' });
  await flush();
  await flush();

  expect(useTrainingStore.getState().sessionsByDate['2026-01-02']).toHaveLength(1);
});

// Regression for the "last days of diary vanished" incident: on a cold start the
// persisted JWT was already expired, the first user_data read came back 401, and
// the device then pushed its own stale snapshot over the remote row a second
// later (edge logs: GET 401 -> POST 200 within ~1s of a token refresh).
describe('remote baseline safety', () => {
  const userDataRow = (dailyCalorieGoal: number, updatedAt: string) => remoteRowAt(dailyCalorieGoal, updatedAt);

  function answerTables(userData: () => unknown) {
    mockMaybeSingle.mockReset();
    mockMaybeSingle.mockImplementation((table: string) =>
      Promise.resolve(table === 'user_data' ? userData() : { data: null, error: null }),
    );
  }

  it('refreshes the session and retries the pull once when the first read is rejected with 401', async () => {
    mockRefreshSession.mockClear();
    const newerTimestamp = new Date(Date.now() + 60_000).toISOString();
    let calls = 0;
    answerTables(() =>
      ++calls === 1
        ? { data: null, error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 }
        : { data: userDataRow(2000, newerTimestamp), error: null },
    );

    useSyncStore.getState().init();
    authCallback?.('INITIAL_SESSION', { user: { id: 'u-jwt' }, access_token: 'tok-jwt' });
    await flush();
    await flush();
    await flush();

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState().user.dailyCalorieGoal).toBe(2000);
    expect(useSyncStore.getState().status).toBe('synced');
  });

  it('never pushes local state while the initial pull keeps failing, then merges once it succeeds', async () => {
    mockUpsert.mockClear();
    let pullFails = true;
    const oldTimestamp = new Date(Date.now() - 60_000).toISOString();
    answerTables(() =>
      pullFails ? { data: null, error: { message: 'boom', code: 'XX000' }, status: 500 } : { data: userDataRow(1800, oldTimestamp), error: null },
    );

    useSyncStore.getState().init();
    authCallback?.('INITIAL_SESSION', { user: { id: 'u-nobaseline' }, access_token: 'tok-nobaseline' });
    await flush();
    await flush();
    await flush();
    expect(useSyncStore.getState().status).toBe('error');

    // A local edit while there is no baseline: recorded, but nothing may be pushed.
    useUserStore.getState().updateGoals({ dailyCalorieGoal: 2600, dailyMacroGoal: { carbs: 300, protein: 190, fat: 85 } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await useSyncStore.getState().syncNow();
    expect(mockUpsert).not.toHaveBeenCalled();

    // Connectivity/auth recovers: the catch-up pull succeeds, the edit survives
    // (remote row is older), and only then is the merged state pushed.
    pullFails = false;
    useSyncStore.getState().reconnect();
    await flush();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await flush();

    expect(useUserStore.getState().user.dailyCalorieGoal).toBe(2600);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[mockUpsert.mock.calls.length - 1][0].data.user.dailyCalorieGoal).toBe(2600);
  });

  it('keeps diary days that only exist remotely when local edits are pending', async () => {
    const remoteEntry = {
      id: 'remote-1',
      foodItem: { id: 'f1', name: 'Reis' },
      mealType: 'lunch',
      servings: 1,
      loggedAt: '2026-09-18T10:00:00.000Z',
    };
    const oldTimestamp = new Date(Date.now() - 60_000).toISOString();
    answerTables(() => ({
      data: { data: { ...userDataRow(1800, oldTimestamp).data, entriesByDate: { '2026-09-18': [remoteEntry] } }, updated_at: oldTimestamp },
      error: null,
    }));
    // Force the "local edit newer than remote" branch, i.e. remote is not applied wholesale.
    await AsyncStorage.setItem('coach-imi-last-local-change', new Date().toISOString());

    useSyncStore.getState().init();
    authCallback?.('INITIAL_SESSION', { user: { id: 'u-merge' }, access_token: 'tok-merge' });
    await flush();
    await flush();
    await flush();

    const { useDiaryStore } = jest.requireActual('@/store/diaryStore');
    expect(useDiaryStore.getState().entriesByDate['2026-09-18']).toHaveLength(1);
  });
});
