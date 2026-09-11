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
    expect(result[0].citation).toContain('Hallberg');
  });

  it('attaches a Morton et al. citation to a flagged protein deficit', () => {
    const snapshots = [
      day('2026-01-01', { protein: 40 }),
      day('2026-01-02', { protein: 45 }),
      day('2026-01-03', { protein: 42 }),
    ];
    const result = analyzeNutrientDeficits(snapshots, 150);
    const proteinDeficit = result.find((entry) => entry.key === 'protein');
    expect(proteinDeficit?.citation).toContain('Morton et al. (2018)');
    expect(proteinDeficit?.citation).toContain('1.6-2.2g');
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

  it('does not flag a nutrient that no logged food ever reported, instead of treating missing data as a zero-intake deficit', () => {
    // iron is 0 every day only because nothing logged that day tracked it (e.g. plain
    // OFF branded products with no micronutrient data) - not because the user actually
    // ate zero iron. Without trackedKeys this would wrongly flag an "8mg" (0-average)
    // iron deficit.
    const snapshots = [
      day('2026-01-01', { iron: 0, trackedKeys: ['protein', 'fiber', 'magnesium'] }),
      day('2026-01-02', { iron: 0, trackedKeys: ['protein', 'fiber', 'magnesium'] }),
      day('2026-01-03', { iron: 0, trackedKeys: ['protein', 'fiber', 'magnesium'] }),
    ];
    const result = analyzeNutrientDeficits(snapshots);
    expect(result.map((entry) => entry.key)).not.toContain('iron');
  });

  it('averages a partially-tracked nutrient only over the days that actually reported it', () => {
    // Real iron data only on the last 3 days (6, 8, 10mg); the first two days logged
    // foods with no iron data at all and must not count as 0mg days, nor drag the
    // 3-day real average down.
    const snapshots = [
      day('2026-01-01', { iron: 0, trackedKeys: ['protein', 'fiber', 'magnesium'] }),
      day('2026-01-02', { iron: 0, trackedKeys: ['protein', 'fiber', 'magnesium'] }),
      day('2026-01-03', { iron: 6, trackedKeys: ['iron', 'protein', 'fiber', 'magnesium'] }),
      day('2026-01-04', { iron: 8, trackedKeys: ['iron', 'protein', 'fiber', 'magnesium'] }),
      day('2026-01-05', { iron: 10, trackedKeys: ['iron', 'protein', 'fiber', 'magnesium'] }),
    ];
    const result = analyzeNutrientDeficits(snapshots);
    const ironDeficit = result.find((entry) => entry.key === 'iron');
    expect(ironDeficit?.averagePerDay).toBe(8);
    expect(ironDeficit?.daysAnalyzed).toBe(3);
  });
});
