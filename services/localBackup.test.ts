jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AUTO_BACKUP_STORAGE_KEY,
  BackupError,
  countDiaryEntries,
  createDiaryBackupJson,
  DIARY_STORAGE_KEY,
  parseDiaryBackup,
  startAutoBackup,
} from '@/services/localBackup';
import { useDiaryStore } from '@/store/diaryStore';
import { useTrainingStore } from '@/store/trainingStore';
import { useUserStore } from '@/store/userStore';

const validEntry = {
  id: 'e1',
  foodItem: {
    id: 'f1',
    name: 'Apfel',
    caloriesPerServing: 52,
    macrosPerServing: { carbs: 14, protein: 0.3, fat: 0.2 },
    micronutrientsPerServing: {},
    servingSize: 100,
    servingUnit: 'g',
  },
  mealType: 'snack',
  servings: 1,
  loggedAt: '2026-09-18T10:00:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useDiaryStore.setState({ entriesByDate: {}, lastUpdatedAt: null });
});

describe('createDiaryBackupJson', () => {
  it('compiles the live diary store into a pretty-printed envelope in persisted-storage shape', async () => {
    useDiaryStore.setState({ entriesByDate: { '2026-09-18': [validEntry as never] } });

    const json = await createDiaryBackupJson();
    const backup = JSON.parse(json);
    expect(json).toContain('\n  "format"');
    expect(backup.format).toBe('coach-imi-diary-backup');
    expect(backup.storageKey).toBe(DIARY_STORAGE_KEY);
    expect(backup.data.state.entriesByDate['2026-09-18']).toHaveLength(1);
    expect(typeof backup.data.version).toBe('number');
  });

  it('exports the live store, not a stale persisted copy', async () => {
    await AsyncStorage.setItem(
      DIARY_STORAGE_KEY,
      JSON.stringify({ state: { entriesByDate: { '2026-01-01': [validEntry] } }, version: 4 }),
    );
    useDiaryStore.setState({ entriesByDate: { '2026-09-19': [validEntry as never] } });

    const backup = JSON.parse(await createDiaryBackupJson());
    expect(Object.keys(backup.data.state.entriesByDate)).toEqual(['2026-09-19']);
  });

  it('includes training and settings sections', async () => {
    useTrainingStore.setState({ templates: [{ id: 't1', name: 'Push', exercises: [] }], sessionsByDate: {} });

    const backup = JSON.parse(await createDiaryBackupJson());
    expect(backup.training.templates[0].name).toBe('Push');
    expect(backup.settings).toEqual(expect.objectContaining({ name: expect.any(String) }));
  });

  it('round-trips through parseDiaryBackup', async () => {
    useDiaryStore.setState({ entriesByDate: { '2026-09-18': [validEntry as never] } });

    const parsed = parseDiaryBackup(await createDiaryBackupJson());
    expect(parsed.importedCount).toBe(1);
    expect(parsed.skippedCount).toBe(0);
    expect(parsed.entriesByDate['2026-09-18'][0].foodItem.name).toBe('Apfel');
  });
});

describe('startAutoBackup', () => {
  it('writes a snapshot to local storage shortly after a store changes', async () => {
    jest.useFakeTimers();
    try {
      await Promise.all([useDiaryStore.persist.rehydrate(), useTrainingStore.persist.rehydrate(), useUserStore.persist.rehydrate()]);
      startAutoBackup();
      useDiaryStore.setState({ entriesByDate: { '2026-09-18': [validEntry as never] } });
      expect(await AsyncStorage.getItem(AUTO_BACKUP_STORAGE_KEY)).toBeNull();

      await jest.advanceTimersByTimeAsync(2500);

      const snapshot = JSON.parse((await AsyncStorage.getItem(AUTO_BACKUP_STORAGE_KEY)) ?? 'null');
      expect(snapshot.data.state.entriesByDate['2026-09-18']).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('parseDiaryBackup', () => {
  it('accepts a raw copy of the persisted storage value and a bare entriesByDate object', () => {
    const raw = JSON.stringify({ state: { entriesByDate: { '2026-09-18': [validEntry] } }, version: 4 });
    const bare = JSON.stringify({ entriesByDate: { '2026-09-18': [validEntry] } });
    expect(parseDiaryBackup(raw).importedCount).toBe(1);
    expect(parseDiaryBackup(bare).importedCount).toBe(1);
  });

  it('skips malformed entries, bad date keys and duplicate ids but keeps the valid ones', () => {
    const text = JSON.stringify({
      entriesByDate: {
        '2026-09-18': [
          validEntry,
          validEntry,
          { ...validEntry, id: 'bad-meal', mealType: 'brunch' },
          { ...validEntry, id: 'bad-servings', servings: -1 },
          { ...validEntry, id: 'bad-food', foodItem: { name: 'x' } },
          { ...validEntry, id: 'bad-date', loggedAt: 'gestern' },
        ],
        'not-a-date': [{ ...validEntry, id: 'other' }],
      },
    });
    const parsed = parseDiaryBackup(text);
    expect(parsed.importedCount).toBe(1);
    expect(parsed.skippedCount).toBe(6);
    expect(countDiaryEntries(parsed.entriesByDate)).toBe(1);
  });

  it('fills in optional food fields instead of rejecting the entry', () => {
    const { micronutrientsPerServing, servingSize, servingUnit, id, ...bareFood } = validEntry.foodItem;
    void micronutrientsPerServing, servingSize, servingUnit, id;
    const parsed = parseDiaryBackup(JSON.stringify({ entriesByDate: { '2026-09-18': [{ ...validEntry, foodItem: bareFood }] } }));
    const food = parsed.entriesByDate['2026-09-18'][0].foodItem;
    expect(food.id).toBe('imported-e1');
    expect(food.servingUnit).toBe('g');
    expect(food.micronutrientsPerServing).toEqual({});
  });

  it.each([
    ['not json', 'kein gültiges JSON'],
    ['[]', 'Keine Tagebuch-Daten'],
    ['{"foo":1}', 'Keine Tagebuch-Daten'],
    ['{"format":"other-app","entriesByDate":{}}', 'Unbekanntes Backup-Format'],
    ['{"entriesByDate":{}}', 'keine Einträge'],
    [JSON.stringify({ entriesByDate: { '2026-09-18': [{ id: 'x' }] } }), 'keine gültigen Einträge'],
  ])('rejects %s', (text, message) => {
    expect(() => parseDiaryBackup(text)).toThrow(BackupError);
    expect(() => parseDiaryBackup(text)).toThrow(message);
  });

  it('cannot be used to smuggle in a __proto__ key', () => {
    const parsed = parseDiaryBackup(
      `{"entriesByDate":{"__proto__":[${JSON.stringify(validEntry)}],"2026-09-18":[${JSON.stringify(validEntry)}]}}`,
    );
    expect(Object.keys(parsed.entriesByDate)).toEqual(['2026-09-18']);
    expect(({} as Record<string, unknown>).id).toBeUndefined();
  });
});
