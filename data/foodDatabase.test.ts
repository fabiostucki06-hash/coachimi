import { fuzzyFilterFoodItems, LOCAL_FOOD_DATABASE, normalizeSearchText, searchLocalFoods } from './foodDatabase';

it('preloads at least 200 staple foods', () => {
  expect(LOCAL_FOOD_DATABASE.length).toBeGreaterThanOrEqual(200);
});

it('has unique ids for every entry', () => {
  const ids = LOCAL_FOOD_DATABASE.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('reports plausible per-100g macros for every entry', () => {
  for (const item of LOCAL_FOOD_DATABASE) {
    expect(item.name.trim().length).toBeGreaterThan(0);
    expect(item.caloriesPerServing).toBeGreaterThanOrEqual(0);
    expect(item.caloriesPerServing).toBeLessThan(950);
    expect(item.macrosPerServing.carbs).toBeGreaterThanOrEqual(0);
    expect(item.macrosPerServing.protein).toBeGreaterThanOrEqual(0);
    expect(item.macrosPerServing.fat).toBeGreaterThanOrEqual(0);
  }
});

describe('searchLocalFoods', () => {
  it('finds a staple by exact name', () => {
    expect(searchLocalFoods('Haferflocken').some((item) => item.name === 'Haferflocken')).toBe(true);
  });

  it('matches a plural form via fuzzy word matching', () => {
    expect(searchLocalFoods('Tomaten').some((item) => item.name === 'Tomate')).toBe(true);
  });

  it('matches through accented/umlaut differences', () => {
    expect(searchLocalFoods('Broetchen').some((item) => item.name === 'Brötchen')).toBe(true);
  });
});

describe('raw vs. cooked meat variants', () => {
  const names = (query: string) => searchLocalFoods(query).map((item) => item.name);

  it('surfaces both states for a bare "Hackfleisch" search, incl. the light variant', () => {
    expect(names('Hackfleisch')).toEqual(
      expect.arrayContaining([
        'Hackfleisch gemischt, roh',
        'Hackfleisch gemischt, gebraten',
        'Rindshackfleisch, roh',
        'Rindshackfleisch, gebraten',
        'Rindshackfleisch light (5% Fett), roh',
        'Rindshackfleisch light (5% Fett), gebraten',
      ]),
    );
  });

  it('narrows to one state when the query names it', () => {
    const raw = names('Hackfleisch roh');
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.every((name) => name.endsWith(', roh'))).toBe(true);
    expect(names('Hackfleisch light gebraten')).toEqual(['Rindshackfleisch light (5% Fett), gebraten']);
  });

  it('finds the Hähnchen/Pute/Hackfleisch entries under their Swiss names', () => {
    expect(names('Pouletbrust')).toEqual(expect.arrayContaining(['Hähnchenbrust, roh', 'Hähnchenbrust, gebraten']));
    expect(names('Trutenbrust roh')).toEqual(['Putenbrust, roh']);
    expect(names('Gehacktes')).toContain('Hackfleisch gemischt, roh');
  });

  it('states a preparation for every plain meat cut, each with a denser cooked counterpart', () => {
    const rawMeats = LOCAL_FOOD_DATABASE.filter((item) => item.name.endsWith(', roh') && item.macrosPerServing.carbs === 0);
    expect(rawMeats.length).toBeGreaterThanOrEqual(12);
    for (const raw of rawMeats) {
      const cooked = LOCAL_FOOD_DATABASE.find((item) => item.name === raw.name.replace(/, roh$/, ', gebraten'));
      expect(cooked).toBeDefined();
      expect(cooked!.caloriesPerServing).toBeGreaterThan(raw.caloriesPerServing);
      expect(cooked!.macrosPerServing.protein).toBeGreaterThan(raw.macrosPerServing.protein);
    }
  });

  it('keeps calories consistent with the macros for every meat variant', () => {
    for (const item of LOCAL_FOOD_DATABASE.filter((entry) => /, (roh|gebraten)$/.test(entry.name) && entry.macrosPerServing.carbs < 1)) {
      const fromMacros = item.macrosPerServing.carbs * 4 + item.macrosPerServing.protein * 4 + item.macrosPerServing.fat * 9;
      expect(Math.abs(item.caloriesPerServing - fromMacros) / item.caloriesPerServing).toBeLessThan(0.08);
    }
  });
});

describe('fuzzyFilterFoodItems', () => {
  it('is order-independent across query words', () => {
    const items = [{ name: 'Hähnchenbrust, gebraten' }];
    expect(fuzzyFilterFoodItems('gebraten haehnchenbrust', items)).toHaveLength(1);
  });
});

describe('normalizeSearchText', () => {
  it('strips diacritics and punctuation, collapsing to single spaces', () => {
    expect(normalizeSearchText('Käse!!  "Gouda"')).toBe('kase gouda');
  });
});
