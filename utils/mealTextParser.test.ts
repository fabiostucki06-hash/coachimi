import { parseMealDescription } from '@/utils/mealTextParser';

describe('parseMealDescription', () => {
  it('parses an explicit weight/volume unit literally', () => {
    const [item] = parseMealDescription('200g Hähnchenbrust', []);
    expect(item).toMatchObject({ name: 'Hähnchenbrust', quantityGrams: 200 });
  });

  it('splits multiple foods on "und"/"mit"', () => {
    const items = parseMealDescription('200g Hähnchenbrust mit 150g Reis und 10g Olivenöl', []);
    expect(items.map((i) => ({ name: i.name, quantityGrams: i.quantityGrams }))).toEqual([
      { name: 'Hähnchenbrust', quantityGrams: 200 },
      { name: 'Reis', quantityGrams: 150 },
      { name: 'Olivenöl', quantityGrams: 10 },
    ]);
  });

  // Regression: a bare count ("2 Bananen") has no weight/volume unit at all, so the old
  // code's "default the unit to grams" fallback silently turned the count itself into
  // grams - logging two bananas as 2g. It must instead use each food's own typical
  // per-piece weight, the same lookup the portion-chip UI uses.
  it('resolves a bare count to the food\'s per-piece weight instead of treating the count as grams', () => {
    expect(parseMealDescription('2 Bananen', [])[0]).toMatchObject({ name: 'Bananen', quantityGrams: 240 });
    expect(parseMealDescription('1 Wrap', [])[0]).toMatchObject({ name: 'Wrap', quantityGrams: 60 });
    expect(parseMealDescription('1 Proteinriegel', [])[0]).toMatchObject({ name: 'Proteinriegel', quantityGrams: 45 });
    expect(parseMealDescription('3 Reiswaffeln', [])[0]).toMatchObject({ name: 'Reiswaffeln', quantityGrams: 27 });
    expect(parseMealDescription('1 Pfirsich', [])[0]).toMatchObject({ name: 'Pfirsich', quantityGrams: 150 });
    expect(parseMealDescription('1 Eis', [])[0]).toMatchObject({ name: 'Eis', quantityGrams: 60 });
  });

  it('falls back to a generic 100g/piece for a bare count of an unrecognized food', () => {
    expect(parseMealDescription('2 Kartoffeln', [])[0]).toMatchObject({ name: 'Kartoffeln', quantityGrams: 200 });
  });

  it('treats explicit "Stück" the same as a bare count, not a flat 100g/unit', () => {
    expect(parseMealDescription('2 Stück Banane', [])[0]).toMatchObject({ name: 'Banane', quantityGrams: 240 });
  });

  it('assumes a standard 100g portion when no quantity is mentioned at all', () => {
    expect(parseMealDescription('Banane', [])[0]).toMatchObject({ name: 'Banane', quantityGrams: 100 });
  });

  it('also resolves a bare count written after the food name', () => {
    expect(parseMealDescription('Banane 2', [])[0]).toMatchObject({ name: 'Banane', quantityGrams: 240 });
  });
});
