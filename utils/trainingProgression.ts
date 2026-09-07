import type { LoggedExercise } from '@/types';

export interface ProgressionComparison {
  volumeKg: number;
  previousVolumeKg: number;
  volumePct: number | null;
  topSetKg: number;
  previousTopSetKg: number;
  strengthPct: number | null;
}

function totalVolume(exercise: LoggedExercise): number {
  return exercise.sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

function topSetWeight(exercise: LoggedExercise): number {
  return exercise.sets.reduce((max, set) => (set.reps > 0 ? Math.max(max, set.weightKg) : max), 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Volume/strength delta vs. the immediately preceding session of the same exercise. */
export function compareToPrevious(current: LoggedExercise, previous: LoggedExercise | null): ProgressionComparison {
  const volumeKg = totalVolume(current);
  const previousVolumeKg = previous ? totalVolume(previous) : 0;
  const topSetKg = topSetWeight(current);
  const previousTopSetKg = previous ? topSetWeight(previous) : 0;

  return {
    volumeKg,
    previousVolumeKg,
    volumePct: previous ? pctChange(volumeKg, previousVolumeKg) : null,
    topSetKg,
    previousTopSetKg,
    strengthPct: previous ? pctChange(topSetKg, previousTopSetKg) : null,
  };
}

/** Double-progression coaching tip: climb reps within the target range first, only add weight once every set hits the top of the range; flag stagnation across the last few sessions so a deload/volume cut gets suggested instead of grinding the same numbers forever. */
export function generateProgressionTip(
  current: LoggedExercise,
  history: LoggedExercise[], // most recent first, NOT including `current`
): string {
  const loggedSets = current.sets.filter((set) => set.reps > 0);
  if (loggedSets.length === 0) return 'Sätze eintragen, um eine Progressions-Empfehlung zu erhalten.';

  const allAtMax = loggedSets.every((set) => set.reps >= current.targetRepsMax);
  const anyBelowMin = loggedSets.some((set) => set.reps < current.targetRepsMin);

  if (allAtMax) {
    return `Alle Sätze mit max. Wiederholungen (${current.targetRepsMax}) geschafft -> Gewicht um 2.5kg erhöhen.`;
  }

  const recentVolumes = [totalVolume(current), ...history.slice(0, 3).map((exercise) => totalVolume(exercise))];
  if (recentVolumes.length >= 4) {
    const [latest, ...prior] = recentVolumes;
    const maxPrior = Math.max(...prior);
    if (maxPrior > 0 && latest <= maxPrior * 1.02) {
      return `Stagnation seit ${prior.length} Einheiten -> Deload oder Satzzahl reduzieren.`;
    }
  }

  if (anyBelowMin) {
    return `Wiederholungen unter Zielbereich (${current.targetRepsMin}-${current.targetRepsMax}) -> Gewicht halten, Technik/Erholung prüfen.`;
  }

  return `Im Zielbereich (${current.targetRepsMin}-${current.targetRepsMax}) -> gleiches Gewicht, nächstes Mal mehr Wiederholungen anstreben.`;
}
