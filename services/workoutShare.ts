import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

import type { TemplateExercise, WorkoutTemplate } from '@/types';

/**
 * Workout plans are shared as a self-contained code: the whole plan (name + exercises with
 * sets and rep range) is packed into the token itself, so opening `/workout/import?code=...`
 * needs no backend row, no account and no network - the receiver's app just decodes it. The
 * trade-off is that a code can't be revoked or edited after sharing, and it grows with the
 * plan (roughly 30 characters per exercise).
 */

const CODE_VERSION = 1;
const MAX_NAME_LENGTH = 80;
const MAX_EXERCISES = 50;
const MAX_CODE_LENGTH = 8000;
const MAX_SETS = 20;
const MAX_REPS = 200;

export const WORKOUT_IMPORT_PATH = '/workout/import';

export class WorkoutShareError extends Error {}

export interface SharedWorkoutPlan {
  name: string;
  exercises: Omit<TemplateExercise, 'id'>[];
}

function toBase64Url(text: string): string {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Packs a plan into a URL-safe share code: `[version, name, [[exercise, sets, repsMin, repsMax], ...]]` as base64url JSON. */
export function encodeWorkoutPlan(template: Pick<WorkoutTemplate, 'name' | 'exercises'>): string {
  const payload = [
    CODE_VERSION,
    template.name,
    template.exercises.map((exercise) => [exercise.name, exercise.targetSets, exercise.targetRepsMin, exercise.targetRepsMax]),
  ];
  return toBase64Url(JSON.stringify(payload));
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function invalidCode(): WorkoutShareError {
  return new WorkoutShareError('Dieser Code ist ungültig oder beschädigt.');
}

/** Decodes and validates a share code. Rejects anything that isn't a well-formed plan; never trusts sizes or types from the code. */
export function decodeWorkoutPlan(code: string): SharedWorkoutPlan {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(trimmed)) throw invalidCode();

  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(trimmed));
  } catch {
    throw invalidCode();
  }

  if (!Array.isArray(payload) || payload[0] !== CODE_VERSION || typeof payload[1] !== 'string' || !Array.isArray(payload[2])) {
    throw invalidCode();
  }

  const name = payload[1].trim().slice(0, MAX_NAME_LENGTH);
  if (!name || payload[2].length === 0 || payload[2].length > MAX_EXERCISES) throw invalidCode();

  const exercises = payload[2].map((raw: unknown): Omit<TemplateExercise, 'id'> => {
    if (!Array.isArray(raw) || typeof raw[0] !== 'string') throw invalidCode();
    const exerciseName = raw[0].trim().slice(0, MAX_NAME_LENGTH);
    const targetSets = clampInt(raw[1], 1, MAX_SETS);
    const targetRepsMin = clampInt(raw[2], 1, MAX_REPS);
    const targetRepsMax = clampInt(raw[3], 1, MAX_REPS);
    if (!exerciseName || targetSets === null || targetRepsMin === null || targetRepsMax === null) throw invalidCode();
    return { name: exerciseName, targetSets, targetRepsMin, targetRepsMax: Math.max(targetRepsMin, targetRepsMax) };
  });

  return { name, exercises };
}

/** Pulls the code out of whatever a user pasted: a full `/workout/import?code=...` link or the bare code. */
export function extractShareCode(input: string): string {
  const match = /[?&]code=([^&#\s]+)/.exec(input);
  return (match ? match[1] : input).trim();
}

export function buildWorkoutShareLink(template: Pick<WorkoutTemplate, 'name' | 'exercises'>): string {
  return Linking.createURL(WORKOUT_IMPORT_PATH, { queryParams: { code: encodeWorkoutPlan(template) } });
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/** Hands the plan's import link to the OS share sheet; on browsers without the Web Share API it copies the link to the clipboard instead. */
export async function shareWorkoutPlan(template: WorkoutTemplate): Promise<ShareOutcome> {
  const link = buildWorkoutShareLink(template);
  const message = `Trainingsplan „${template.name}“ in Coach imi importieren:\n${link}`;

  if (Platform.OS !== 'web') {
    const result = await Share.share({ message });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: template.name, text: message });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Any other failure (e.g. share blocked outside a user gesture) falls through to the clipboard.
    }
  }

  await navigator.clipboard.writeText(link);
  return 'copied';
}
