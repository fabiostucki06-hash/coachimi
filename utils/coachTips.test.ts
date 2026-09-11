import { analyzeNutrientDeficits, type DailyNutrientSnapshot } from './coachTips';

function day(date: string, overrides: Partial<DailyNutrientSnapshot> = {}): DailyNutrientSnapshot {
  return { date, iron: 18, protein: 100, fiber: 30, magnesium: 420, ...overrides };
}

describe('analyzeNutrientDeficits', () => {
  it('returns nothing with fewer than 3 logged days', () => {
    const result = analyzeNutrientDeficits([day('2026-01-01'), day('2026-01-02')]);
    expect(result).toEqual([]);
  });

  it('returns nothing when intake meets the reference intake', () => {
    const result = analyzeNutrientDeficits([day('2026-01-01'), day('2026-01-02'), day('2026-01-03')]);
    expect(result).toEqual([]);
  });

  it('flags a low multi-day iron average with a sourced suggestion', () => {
    const snapshots = [
      day('2026-01-01', { iron: 6 }),
      day('2026-01-02', { iron: 8 }),
      day('2026-01-03', { iron: 10 }),
    ];
    const result = analyzeNutrientDeficits(snapshots);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('iron');
    expect(result[0].averagePerDay).toBe(8);
    expect(result[0].message).toContain('in den letzten 3 Tagen im Schnitt nur 8mg Eisen/Tag');
    expect(result[0].message).toContain('Linsen');
  });

  it('sorts multiple deficits worst-first', () => {
    const snapshots = [
      day('2026-01-01', { iron: 10, fiber: 5 }),
      day('2026-01-02', { iron: 11, fiber: 6 }),
      day('2026-01-03', { iron: 12, fiber: 4 }),
    ];
    const result = analyzeNutrientDeficits(snapshots);
    expect(result.map((entry) => entry.key)).toEqual(['fiber', 'iron']);
  });

  it('uses the user protein goal as the reference intake when provided', () => {
    const snapshots = [day('2026-01-01', { protein: 90 }), day('2026-01-02', { protein: 90 }), day('2026-01-03', { protein: 90 })];
    const result = analyzeNutrientDeficits(snapshots, 150);
    expect(result.map((entry) => entry.key)).toContain('protein');
  });
});
