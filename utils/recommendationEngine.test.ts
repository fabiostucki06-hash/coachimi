import { generateRecommendation, getTimeOfDay } from './recommendationEngine';

describe('getTimeOfDay', () => {
  it('returns morning before 12:00', () => {
    expect(getTimeOfDay(new Date('2026-01-01T08:00:00'))).toBe('morning');
  });

  it('returns midday between 12:00 and 18:00', () => {
    expect(getTimeOfDay(new Date('2026-01-01T14:00:00'))).toBe('midday');
  });

  it('returns evening from 18:00 onward', () => {
    expect(getTimeOfDay(new Date('2026-01-01T20:00:00'))).toBe('evening');
  });
});

describe('generateRecommendation', () => {
  it('reports the goal as reached when no calories remain', () => {
    const result = generateRecommendation('evening', 0, { carbs: 0, protein: 0, fat: 0 });
    expect(result.headline).toBe('Tagesziel erreicht');
    expect(result.mode).toBe('food');
  });

  it('highlights the macro with the largest remaining gap', () => {
    const result = generateRecommendation('evening', 400, { carbs: 10, protein: 35, fat: 5 });
    expect(result.headline).toBe('Noch 35g Protein übrig');
    expect(result.suggestion).toContain('Magerquark mit Beeren');
    expect(result.mode).toBe('food');
  });

  it('cycles through variants of the dominant macro tip pool', () => {
    const result = generateRecommendation('morning', 400, { carbs: 10, protein: 35, fat: 5 }, undefined, 1);
    expect(result.suggestion).toContain('Hähnchenbrustfilet');
    expect(result.variantCount).toBeGreaterThan(1);
  });

  it('fixes subject-verb agreement for plural food names', () => {
    // 'Reiswaffeln' is the 4th carbs entry (index 3) - plural subject needs "passen", not "passt".
    const result = generateRecommendation('evening', 400, { carbs: 90, protein: 10, fat: 5 }, undefined, 3);
    expect(result.suggestion).toContain('Reiswaffeln mit Honig passen');
  });

  it('suggests a balanced meal when the top two macro gaps are close', () => {
    const result = generateRecommendation('evening', 400, { carbs: 30, protein: 32, fat: 10 });
    expect(result.headline).toBe('Noch 400 kcal übrig');
    expect(result.suggestion).toMatch(/Lachsfilet|Vollkorn-Wrap|Gemischter Salat/);
  });

  it('prefers light snacks over the dominant macro once very few calories remain', () => {
    const result = generateRecommendation('evening', 120, { carbs: 10, protein: 40, fat: 5 });
    expect(result.headline).toBe('Noch 120 kcal übrig');
    expect(result.mode).toBe('food');
    expect(result.suggestion).toMatch(/Gurkenscheiben|Beerenmix/);
  });

  it('falls back to a macro-free balanced pool when every macro is hidden', () => {
    const result = generateRecommendation(
      'evening',
      400,
      { carbs: 10, protein: 35, fat: 5 },
      { protein: false, carbs: false, fat: false },
    );
    expect(result.headline).toBe('Noch 400 kcal übrig');
    expect(result.suggestion).not.toMatch(/Protein|Kohlenhydrate|Fett/);
  });

  it('cycles into a timing tip once the variant index passes the food pool', () => {
    const result = generateRecommendation('evening', 400, { carbs: 10, protein: 35, fat: 5 }, undefined, 22);
    expect(result.mode).toBe('timing');
    expect(result.modeLabel).toBe('Tactical Tipp');
    expect(result.suggestion.length).toBeGreaterThan(0);
  });

  it('only surfaces timing tips relevant to the current time of day', () => {
    const eveningTip = generateRecommendation('evening', 400, { carbs: 10, protein: 35, fat: 5 }, undefined, 22);
    expect(eveningTip.headline).not.toBe('Tageslicht-Boost');
  });

  it('cycles into a hydration tip at the end of the combined pool', () => {
    const result = generateRecommendation('evening', 400, { carbs: 10, protein: 35, fat: 5 }, undefined, -1);
    expect(result.mode).toBe('hydration');
    expect(result.modeLabel).toBe('Hydration');
  });
});
