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
  });

  it('highlights the macro with the largest remaining gap', () => {
    const result = generateRecommendation('evening', 400, { carbs: 10, protein: 35, fat: 5 });
    expect(result.headline).toBe('Noch 35g Protein übrig');
    expect(result.suggestion).toContain('Magerquark mit Beeren');
  });

  it('cycles through variants of the dominant macro tip pool', () => {
    const result = generateRecommendation('morning', 400, { carbs: 10, protein: 35, fat: 5 }, undefined, 1);
    expect(result.suggestion).toContain('Hähnchenbrustfilet');
    expect(result.variantCount).toBeGreaterThan(1);
  });

  it('suggests a balanced meal when the top two macro gaps are close', () => {
    const result = generateRecommendation('evening', 400, { carbs: 30, protein: 32, fat: 10 });
    expect(result.headline).toBe('Noch 400 kcal übrig');
    expect(result.suggestion).toMatch(/Lachsfilet|Vollkorn-Wrap|Gemischter Salat/);
  });
});
