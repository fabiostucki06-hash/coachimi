import { getDefaultPortionUnit, getKnownPortionUnit, getPortionUnitsForFood, getPortionWeightForCount } from '@/utils/portionUnits';

describe('getPortionUnitsForFood', () => {
  it('matches apple/pear-type fruit', () => {
    expect(getPortionUnitsForFood('Apfel').map((u) => u.id)).toEqual(['apple_small', 'apple_medium', 'apple_large']);
    expect(getPortionUnitsForFood('Bio Äpfel').map((u) => u.id)[0]).toBe('apple_small');
    expect(getPortionUnitsForFood('Williams Birne').map((u) => u.id)[0]).toBe('apple_small');
  });

  it('matches banana-type fruit', () => {
    expect(getPortionUnitsForFood('Banane').map((u) => u.id)).toEqual(['banana_small', 'banana_medium', 'banana_large']);
  });

  it('matches bread/baked goods', () => {
    expect(getPortionUnitsForFood('Vollkornbrot').map((u) => u.id)).toEqual(['slice_thin', 'slice_medium', 'slice_thick']);
    expect(getPortionUnitsForFood('Toast').map((u) => u.id)[0]).toBe('slice_thin');
  });

  it('matches snack/protein bars', () => {
    expect(getPortionUnitsForFood('Proteinriegel Schoko').map((u) => u.id)).toEqual(['bar_half', 'bar_whole']);
  });

  it('matches eggs without false-matching words that merely contain "ei"', () => {
    expect(getPortionUnitsForFood('Ei').map((u) => u.id)).toEqual(['egg_m', 'egg_l']);
    expect(getPortionUnitsForFood('Eier').map((u) => u.id)).toEqual(['egg_m', 'egg_l']);
    expect(getPortionUnitsForFood('Reis').map((u) => u.id)).not.toEqual(['egg_m', 'egg_l']);
    expect(getPortionUnitsForFood('Fleisch').map((u) => u.id)).not.toEqual(['egg_m', 'egg_l']);
  });

  it('matches wraps and tortillas', () => {
    expect(getPortionUnitsForFood('Tortilla Wrap').map((u) => u.id)).toEqual(['wrap_small', 'wrap_medium', 'wrap_large']);
    expect(getPortionUnitsForFood('Hähnchen Wraps').map((u) => u.id)[0]).toBe('wrap_small');
  });

  it('matches rice cakes', () => {
    expect(getPortionUnitsForFood('Reiswaffel Natur').map((u) => u.id)).toEqual(['ricecake_single', 'ricecake_double']);
  });

  it('matches peaches and nectarines', () => {
    expect(getPortionUnitsForFood('Pfirsich').map((u) => u.id)).toEqual(['peach_small', 'peach_medium', 'peach_large']);
    expect(getPortionUnitsForFood('Nektarine').map((u) => u.id)[0]).toBe('peach_small');
  });

  it('matches ice cream without false-matching "...reis" dishes', () => {
    expect(getPortionUnitsForFood('Vanilleeis').map((u) => u.id)).toEqual(['icecream_scoop', 'icecream_double', 'icecream_bar']);
    expect(getPortionUnitsForFood('Schokoeis').map((u) => u.id)[0]).toBe('icecream_scoop');
    expect(getPortionUnitsForFood('Eiscreme').map((u) => u.id)[0]).toBe('icecream_scoop');
    expect(getPortionUnitsForFood('Reis').map((u) => u.id)).not.toEqual(['icecream_scoop', 'icecream_double', 'icecream_bar']);
    expect(getPortionUnitsForFood('Milchreis').map((u) => u.id)).not.toEqual(['icecream_scoop', 'icecream_double', 'icecream_bar']);
  });

  it('falls back to generic portion-size presets for anything unrecognized', () => {
    expect(getPortionUnitsForFood('Reis').map((u) => u.id)).toEqual(['portion_small', 'portion_medium', 'portion_large']);
    expect(getPortionUnitsForFood('Hähnchenbrust').map((u) => u.id)).toEqual(['portion_small', 'portion_medium', 'portion_large']);
  });
});

describe('getDefaultPortionUnit', () => {
  it('defaults a scanned bar to one whole bar, not a half', () => {
    expect(getDefaultPortionUnit('Proteinriegel Schoko').id).toBe('bar_whole');
  });

  it('defaults matched categories to their typical size', () => {
    expect(getDefaultPortionUnit('Apfel').id).toBe('apple_medium');
    expect(getDefaultPortionUnit('Banane').id).toBe('banana_medium');
    expect(getDefaultPortionUnit('Vollkornbrot').id).toBe('slice_medium');
    expect(getDefaultPortionUnit('Ei').id).toBe('egg_m');
  });

  it('defaults unrecognized foods to a normal-sized generic portion', () => {
    expect(getDefaultPortionUnit('Hähnchenbrust').id).toBe('portion_medium');
  });
});

describe('getKnownPortionUnit', () => {
  it('returns a specific match for recognized foods', () => {
    expect(getKnownPortionUnit('Banane')?.id).toBe('banana_medium');
    expect(getKnownPortionUnit('Tortilla Wrap')?.id).toBe('wrap_medium');
  });

  it('returns null instead of guessing a generic portion for unrecognized foods', () => {
    expect(getKnownPortionUnit('Hähnchenbrust')).toBeNull();
    expect(getKnownPortionUnit('Reis')).toBeNull();
  });
});

describe('getPortionWeightForCount', () => {
  it('multiplies a recognized food\'s typical per-piece weight by the count', () => {
    expect(getPortionWeightForCount('Banane', 2)).toBe(240);
    expect(getPortionWeightForCount('Reiswaffel', 3)).toBe(27);
    expect(getPortionWeightForCount('Proteinriegel', 1)).toBe(45);
  });

  it('falls back to a generic 100g per piece for unrecognized foods', () => {
    expect(getPortionWeightForCount('Kartoffel', 2)).toBe(200);
  });
});
