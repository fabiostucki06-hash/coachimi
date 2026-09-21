import { decodeWorkoutPlan, encodeWorkoutPlan, extractShareCode, WorkoutShareError } from '@/services/workoutShare';

const plan = {
  name: 'Push Tag – Brust & Schulter',
  exercises: [
    { id: 'a', name: 'Bankdrücken', targetSets: 4, targetRepsMin: 6, targetRepsMax: 8 },
    { id: 'b', name: 'Schrägbank Kurzhantel', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
  ],
};

function codeFor(payload: unknown): string {
  let binary = '';
  new TextEncoder().encode(JSON.stringify(payload)).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('workout share code', () => {
  it('round-trips a plan including umlauts and symbols, without exercise ids', () => {
    const code = encodeWorkoutPlan(plan);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeWorkoutPlan(code)).toEqual({
      name: 'Push Tag – Brust & Schulter',
      exercises: [
        { name: 'Bankdrücken', targetSets: 4, targetRepsMin: 6, targetRepsMax: 8 },
        { name: 'Schrägbank Kurzhantel', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      ],
    });
  });

  it('extracts the code from a full import link or a bare code', () => {
    const code = encodeWorkoutPlan(plan);
    expect(extractShareCode(`https://app.example/workout/import?code=${code}`)).toBe(code);
    expect(extractShareCode(`  coachimi://workout/import?foo=1&code=${code}&x=2 `)).toBe(code);
    expect(extractShareCode(`  ${code}  `)).toBe(code);
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', 'not a code!', 'AAAA', codeFor({ a: 1 }), codeFor([2, 'x', [['Y', 3, 8, 12]]]), codeFor([1, '', [['Y', 3, 8, 12]]]), codeFor([1, 'x', []])]) {
      expect(() => decodeWorkoutPlan(bad)).toThrow(WorkoutShareError);
    }
  });

  it('rejects exercises with missing names or non-numeric values', () => {
    expect(() => decodeWorkoutPlan(codeFor([1, 'x', [['', 3, 8, 12]]]))).toThrow(WorkoutShareError);
    expect(() => decodeWorkoutPlan(codeFor([1, 'x', [['Y', 'drei', 8, 12]]]))).toThrow(WorkoutShareError);
    expect(() => decodeWorkoutPlan(codeFor([1, 'x', ['nope']]))).toThrow(WorkoutShareError);
  });

  it('clamps out-of-range numbers and keeps repsMax >= repsMin', () => {
    const decoded = decodeWorkoutPlan(codeFor([1, 'x', [['Y', 9999, 12, 5]]]));
    expect(decoded.exercises[0]).toEqual({ name: 'Y', targetSets: 20, targetRepsMin: 12, targetRepsMax: 12 });
  });
});
