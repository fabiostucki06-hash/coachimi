import AsyncStorage from '@react-native-async-storage/async-storage';

import { useDiaryStore } from '@/store/diaryStore';
import type { FoodItem, MealEntry, MealType } from '@/types';

// Same key store/diaryStore.ts's persist middleware writes to - the backup is a
// copy of exactly what this device has on disk, wrapped in a small envelope so
// an import can tell a real Coach imi backup from an arbitrary JSON file.
export const DIARY_STORAGE_KEY = 'coach-imi-diary-storage';
const BACKUP_FORMAT = 'coach-imi-diary-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

export class BackupError extends Error {}

export interface ParsedBackup {
  entriesByDate: Record<string, MealEntry[]>;
  importedCount: number;
  skippedCount: number;
}

export function countDiaryEntries(entriesByDate: Record<string, MealEntry[]>): number {
  return Object.values(entriesByDate).reduce((sum, entries) => sum + entries.length, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Serializes the on-disk diary (coach-imi-diary-storage) as a pretty-printed backup file body. Falls back to the live store if nothing has been persisted yet. */
export async function createDiaryBackupJson(): Promise<string> {
  const raw = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
  const persisted = raw ? safeParse(raw) : undefined;
  const hasPersistedDiary = isRecord(persisted) && isRecord(persisted.state) && isRecord(persisted.state.entriesByDate);

  const { entriesByDate, lastUpdatedAt } = useDiaryStore.getState();
  const data = hasPersistedDiary
    ? persisted
    : { state: { entriesByDate, lastUpdatedAt }, version: useDiaryStore.persist.getOptions().version ?? 0 };

  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      storageKey: DIARY_STORAGE_KEY,
      data,
    },
    null,
    2,
  );
}

function sanitizeFoodItem(value: unknown, entryId: string): FoodItem | null {
  if (!isRecord(value)) return null;
  const { name, caloriesPerServing, macrosPerServing } = value;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (!isFiniteNumber(caloriesPerServing) || caloriesPerServing < 0) return null;
  if (
    !isRecord(macrosPerServing) ||
    !isFiniteNumber(macrosPerServing.carbs) ||
    !isFiniteNumber(macrosPerServing.protein) ||
    !isFiniteNumber(macrosPerServing.fat)
  ) {
    return null;
  }

  return {
    ...(value as unknown as FoodItem),
    id: typeof value.id === 'string' && value.id !== '' ? value.id : `imported-${entryId}`,
    micronutrientsPerServing: isRecord(value.micronutrientsPerServing)
      ? (value.micronutrientsPerServing as FoodItem['micronutrientsPerServing'])
      : {},
    servingSize: isFiniteNumber(value.servingSize) && value.servingSize > 0 ? value.servingSize : 100,
    servingUnit: typeof value.servingUnit === 'string' && value.servingUnit !== '' ? value.servingUnit : 'g',
  };
}

function sanitizeEntry(value: unknown): MealEntry | null {
  if (!isRecord(value)) return null;
  const { id, mealType, servings, loggedAt } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof mealType !== 'string' || !MEAL_TYPES.includes(mealType as MealType)) return null;
  if (!isFiniteNumber(servings) || servings <= 0) return null;
  if (typeof loggedAt !== 'string' || Number.isNaN(Date.parse(loggedAt))) return null;
  const foodItem = sanitizeFoodItem(value.foodItem, id);
  if (!foodItem) return null;
  return { id, foodItem, mealType: mealType as MealType, servings, loggedAt };
}

// Accepts this app's own backup envelope, a raw copy of the persisted storage
// value ({ state: { entriesByDate }, version }), or a bare { entriesByDate }.
function extractEntriesByDate(root: unknown): unknown {
  if (!isRecord(root)) return undefined;
  if (root.format !== undefined && root.format !== BACKUP_FORMAT) {
    throw new BackupError('Unbekanntes Backup-Format.');
  }
  const candidates = [
    isRecord(root.data) && isRecord(root.data.state) ? root.data.state.entriesByDate : undefined,
    isRecord(root.state) ? root.state.entriesByDate : undefined,
    root.entriesByDate,
  ];
  return candidates.find(isRecord);
}

/**
 * Validates a backup file's text and returns only the entries that are well-formed.
 * Malformed entries are skipped (and counted) rather than aborting the whole
 * import, but a file with no usable entries at all is rejected.
 */
export function parseDiaryBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('Die Datei ist zu groß für ein Backup.');

  const root = safeParse(text);
  if (root === undefined) throw new BackupError('Die Datei ist kein gültiges JSON.');

  const rawEntriesByDate = extractEntriesByDate(root);
  if (!isRecord(rawEntriesByDate)) throw new BackupError('Keine Tagebuch-Daten in der Datei gefunden.');

  const entriesByDate: Record<string, MealEntry[]> = {};
  let importedCount = 0;
  let skippedCount = 0;

  for (const [date, rawEntries] of Object.entries(rawEntriesByDate)) {
    if (!DATE_KEY.test(date) || !Array.isArray(rawEntries)) {
      skippedCount += Array.isArray(rawEntries) ? rawEntries.length : 1;
      continue;
    }
    const seenIds = new Set<string>();
    const valid: MealEntry[] = [];
    for (const rawEntry of rawEntries) {
      const entry = sanitizeEntry(rawEntry);
      if (!entry || seenIds.has(entry.id)) {
        skippedCount += 1;
        continue;
      }
      seenIds.add(entry.id);
      valid.push(entry);
    }
    if (valid.length > 0) {
      entriesByDate[date] = valid;
      importedCount += valid.length;
    }
  }

  if (importedCount === 0) {
    throw new BackupError(skippedCount > 0 ? 'Das Backup enthält keine gültigen Einträge.' : 'Das Backup enthält keine Einträge.');
  }
  return { entriesByDate, importedCount, skippedCount };
}
