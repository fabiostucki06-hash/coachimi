import { canonicalizeFoodTerms, normalizeSearchText, translateFoodQueryToGerman } from './foodAliases';
import { searchLocalFoods } from './foodDatabase';

const names = (query: string) => searchLocalFoods(query).map((item) => item.name);

describe('translateFoodQueryToGerman', () => {
  it.each([
    ['chicken breast', 'Hähnchenbrust'],
    ['Blanc de poulet', 'Hähnchenbrust'],
    ['petto di pollo', 'Hähnchenbrust'],
    ['bœuf haché', 'Rindshackfleisch'],
    ["huile d'olive", 'Olivenöl'],
    ['Pouletbrust', 'hähnchenbrust'],
    ['riso integrale', 'Vollkornreis'],
  ])('%s -> %s', (query, german) => {
    expect(translateFoodQueryToGerman(query)).toBe(german);
  });

  it('keeps the words it does not know and drops leftover connectors', () => {
    expect(translateFoodQueryToGerman('Migros chicken breast')).toBe('migros Hähnchenbrust');
    expect(translateFoodQueryToGerman('petto de poulet')).toBe('Brust hähnchen');
  });

  it('returns null for a query with nothing to translate', () => {
    expect(translateFoodQueryToGerman('Haferflocken')).toBeNull();
    expect(translateFoodQueryToGerman('ESN Designer Whey')).toBeNull();
    expect(translateFoodQueryToGerman('   ')).toBeNull();
  });

  it('only translates whole words, never part of a longer one', () => {
    expect(translateFoodQueryToGerman('Risotto')).toBeNull();
    expect(translateFoodQueryToGerman('Chickpea Curry')).toBeNull();
  });
});

describe('canonicalizeFoodTerms', () => {
  it('prefers the longest phrase', () => {
    expect(canonicalizeFoodTerms('pomme de terre')).toBe('kartoffeln');
    expect(canonicalizeFoodTerms('pomme')).toBe('apfel');
  });
});

describe('normalizeSearchText', () => {
  it('spells out ligatures and ß instead of dropping them', () => {
    expect(normalizeSearchText('Bœuf')).toBe('boeuf');
    expect(normalizeSearchText('Weißbrot')).toBe('weissbrot');
  });
});

describe('searching the common-foods list in other languages', () => {
  it.each([
    ['chicken breast', 'Hähnchenbrust, roh'],
    ['blanc de poulet', 'Hähnchenbrust, gebraten'],
    ['petto di pollo', 'Hähnchenbrust, roh'],
    ['ground beef', 'Rindshackfleisch, roh'],
    ['viande hachée', 'Hackfleisch gemischt, roh'],
    ['carne macinata', 'Hackfleisch gemischt, gebraten'],
    ['riz', 'Reis, gekocht'],
    ['oats', 'Haferflocken'],
    ['lait entier', 'Vollmilch, 3,8%'],
    ['olio di oliva', 'Olivenöl'],
    ['salmon', 'Lachs, gegart'],
    ['pommes de terre', 'Kartoffeln, gekocht'],
    ['Weissbrot', 'Weißbrot'],
  ])('%s finds %s', (query, expected) => {
    expect(names(query)).toContain(expected);
  });

  it('carries the preparation state across languages', () => {
    expect(names('raw chicken breast')).toEqual(['Hähnchenbrust, roh']);
    expect(names('poulet cru')).toEqual(expect.arrayContaining(['Hähnchenbrust, roh', 'Hähnchenschenkel, roh']));
    expect(names('cooked chicken breast')).toEqual(['Hähnchenbrust, gebraten']);
    expect(names('riso cotto')).toContain('Reis, gekocht');
  });

  it('tolerates a misspelled word in a mixed-language query', () => {
    expect(names('petty de poulet')).toEqual(expect.arrayContaining(['Hähnchenbrust, roh', 'Hähnchenbrust, gebraten']));
    expect(names('chiken breast')).toContain('Hähnchenbrust, roh');
  });

  it('leaves German words alone that merely resemble a foreign one', () => {
    expect(names('Mango')).toEqual(['Mango', 'Mangold']);
    expect(names('Mango roh')).toEqual([]);
    expect(names('Minze')).toEqual([]);
    expect(names('Risotto')).not.toContain('Reis, gekocht');
  });
});
