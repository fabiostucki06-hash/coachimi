import { getPortionUnitsForFood } from '@/utils/portionUnits';

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

  it('falls back to generic portion-size presets for anything unrecognized', () => {
    expect(getPortionUnitsForFood('Reis').map((u) => u.id)).toEqual(['portion_small', 'portion_medium', 'portion_large']);
    expect(getPortionUnitsForFood('Hähnchenbrust').map((u) => u.id)).toEqual(['portion_small', 'portion_medium', 'portion_large']);
  });
});
