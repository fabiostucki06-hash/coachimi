import {
  calculateBMR,
  calculateDailyTargets,
  calculateMacros,
  calculateTDEE,
  caloriesFromMacros,
  type ActivityLevel,
  type Gender,
  type Goal,
} from './nutritionCalculator';

describe('calculateBMR', () => {
  it('calculates BMR for a male using the Mifflin-St Jeor formula', () => {
    expect(calculateBMR({ age: 30, gender: 'male', weightKg: 80, heightCm: 180 })).toBe(1780);
  });

  it('calculates BMR for a female using the Mifflin-St Jeor formula', () => {
    expect(calculateBMR({ age: 25, gender: 'female', weightKg: 60, heightCm: 165 })).toBe(1345);
  });

  it('handles an extremely low but valid body weight', () => {
    // 10*35 + 6.25*150 - 5*20 - 161 = 1026.5 -> 1027
    expect(calculateBMR({ age: 20, gender: 'female', weightKg: 35, heightCm: 150 })).toBe(1027);
  });

  it('handles an extremely high but valid body weight', () => {
    // 10*250 + 6.25*210 - 5*40 + 5 = 3617.5 -> 3618
    expect(calculateBMR({ age: 40, gender: 'male', weightKg: 250, heightCm: 210 })).toBe(3618);
  });

  it('throws for zero or negative weight', () => {
    expect(() => calculateBMR({ age: 30, gender: 'male', weightKg: 0, heightCm: 180 })).toThrow();
    expect(() => calculateBMR({ age: 30, gender: 'male', weightKg: -10, heightCm: 180 })).toThrow();
  });

  it('throws for zero or negative height', () => {
    expect(() => calculateBMR({ age: 30, gender: 'male', weightKg: 80, heightCm: 0 })).toThrow();
    expect(() =>
      calculateBMR({ age: 30, gender: 'male', weightKg: 80, heightCm: -180 })
    ).toThrow();
  });

  it('throws for zero or negative age', () => {
    expect(() => calculateBMR({ age: 0, gender: 'male', weightKg: 80, heightCm: 180 })).toThrow();
    expect(() => calculateBMR({ age: -5, gender: 'male', weightKg: 80, heightCm: 180 })).toThrow();
  });

  it('throws for an invalid gender value', () => {
    expect(() =>
      calculateBMR({ age: 30, gender: 'other' as Gender, weightKg: 80, heightCm: 180 })
    ).toThrow();
  });
});

describe('calculateTDEE', () => {
  const bmr = 1780;

  it.each<[ActivityLevel, number]>([
    ['sedentary', 2136],
    ['light', 2448],
    ['moderate', 2759],
    ['active', 3071],
  ])('applies the %s activity factor', (activityLevel, expected) => {
    expect(calculateTDEE(bmr, activityLevel)).toBe(expected);
  });

  it('throws for zero or negative BMR', () => {
    expect(() => calculateTDEE(0, 'sedentary')).toThrow();
    expect(() => calculateTDEE(-100, 'sedentary')).toThrow();
  });

  it('throws for an invalid activity level', () => {
    expect(() => calculateTDEE(bmr, 'extreme' as ActivityLevel)).toThrow();
  });
});

describe('calculateDailyTargets', () => {
  const tdee = 2136;

  it.each<[Goal, number]>([
    ['weight_loss', 1636],
    ['maintain', 2136],
    ['muscle_gain', 2436],
  ])('applies the %s adjustment', (goal, expected) => {
    expect(calculateDailyTargets(tdee, goal)).toBe(expected);
  });

  it('throws for zero or negative TDEE', () => {
    expect(() => calculateDailyTargets(0, 'maintain')).toThrow();
    expect(() => calculateDailyTargets(-500, 'maintain')).toThrow();
  });

  it('throws for an invalid goal', () => {
    expect(() => calculateDailyTargets(tdee, 'bulk' as Goal)).toThrow();
  });

  it('does not clamp an extremely low TDEE combined with weight_loss', () => {
    expect(calculateDailyTargets(300, 'weight_loss')).toBe(-200);
  });
});

describe('calculateMacros', () => {
  it('splits calories into 30% protein / 40% carbs / 30% fat by grams', () => {
    expect(calculateMacros(2000)).toEqual({ protein: 150, carbs: 200, fat: 67 });
  });

  it('rounds gram values to the nearest whole gram', () => {
    // 1500: protein 112.5g -> 113, carbs 150g, fat 50g
    expect(calculateMacros(1500)).toEqual({ protein: 113, carbs: 150, fat: 50 });
  });

  it('throws for zero or negative calories', () => {
    expect(() => calculateMacros(0)).toThrow();
    expect(() => calculateMacros(-100)).toThrow();
  });
});

describe('caloriesFromMacros', () => {
  it('re-derives calories from grams using 4/4/9 kcal-per-gram', () => {
    expect(caloriesFromMacros({ carbs: 200, protein: 150, fat: 67 })).toBe(2003);
  });

  it('reconciles the drift left by calculateMacros rounding each macro independently', () => {
    // 2200 kcal balanced (30/40/30) -> protein 165g, carbs 220g, fat 73g,
    // which sum back to 2197 kcal, not the original 2200.
    const macros = calculateMacros(2200);
    expect(macros).toEqual({ protein: 165, carbs: 220, fat: 73 });
    expect(caloriesFromMacros(macros)).toBe(2197);
  });
});
