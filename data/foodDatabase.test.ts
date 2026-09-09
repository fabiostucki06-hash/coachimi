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
