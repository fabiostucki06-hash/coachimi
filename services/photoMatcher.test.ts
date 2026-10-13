jest.mock('@/services/foodSearch', () => ({
  searchFoodHybrid: jest.fn(),
}));

import { searchFoodHybrid } from '@/services/foodSearch';
import { AUTO_APPLY_MATCH_THRESHOLD, correctedValuesFromMatch, matchDetectedFoods, nameSimilarity, preparationState, type PhotoMatch } from '@/services/photoMatcher';
import type { DetectedFoodItem } from '@/services/visionFoodApi';
import type { FoodItem } from '@/types';

const mockedSearch = searchFoodHybrid as jest.MockedFunction<typeof searchFoodHybrid>;

function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'db-1',
    name: 'Hähnchenbrust',
    caloriesPerServing: 165,
    macrosPerServing: { carbs: 0, protein: 31, fat: 3.6 },
    micronutrientsPerServing: { iron: 0.9, sugar: 0, sodium: 74, fiber: 0 },
    servingSize: 100,
    servingUnit: 'g',
    source: 'usda',
    ...overrides,
  };
}

function makeDetected(overrides: Partial<DetectedFoodItem> = {}): DetectedFoodItem {
  return {
    name: 'Hähnchenbrust gebraten',
    cookingMethod: 'gebraten',
    portionLabel: null,
    estimatedGrams: 180,
    caloriesPer100g: 200,
    macrosPer100g: { carbs: 1, protein: 28, fat: 8 },
    micronutrientsPer100g: { iron: 0.6, sugar: 0, sodium: 90 },
    confidence: 0.7,
    confidenceTier: 'medium',
    needsVerification: false,
    hiddenFatGrams: 0,
    nameAlternatives: [],
    ...overrides,
  };
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('matchDetectedFoods - multi-item plate payload', () => {
  it('resolves Meat + Rice + Vegetables independently in one Promise.all pass', async () => {
    const meat = makeDetected({ name: 'Hähnchenbrust gebraten' });
    const rice = makeDetected({ name: 'Reis gekocht', estimatedGrams: 150 });
    const veg = makeDetected({ name: 'Brokkoli gedämpft', estimatedGrams: 100 });

    mockedSearch.mockImplementation(async (query: string) => {
      if (query.includes('Hähnchenbrust')) return [makeFood({ id: 'meat', name: 'Hähnchenbrust' })];
      if (query.includes('Reis')) return [makeFood({ id: 'rice', name: 'Reis gekocht', caloriesPerServing: 130 })];
      return []; // Brokkoli: no DB hit at all for this plate
    });

    const results = await matchDetectedFoods([meat, rice, veg]);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ status: 'db_verified', candidate: { id: 'meat' } });
    expect(results[1]).toMatchObject({ status: 'db_verified', candidate: { id: 'rice' } });
    expect(results[2]).toEqual({ status: 'ai_estimate', candidate: null, score: 0 });
  });

  it('never throws when one item in the plate fails to search - it degrades to ai_estimate for that item only', async () => {
    const meat = makeDetected({ name: 'Hähnchenbrust gebraten' });
    const rice = makeDetected({ name: 'Reis gekocht' });

    mockedSearch.mockImplementation(async (query: string) => {
      if (query.includes('Hähnchenbrust')) return [makeFood({ id: 'meat', name: 'Hähnchenbrust' })];
      throw new Error('network down');
    });

    const results = await matchDetectedFoods([meat, rice]);

    expect(results[0].status).toBe('db_verified');
    expect(results[1]).toEqual({ status: 'ai_estimate', candidate: null, score: 0 });
  });
});

describe('matchDetectedFood - USDA deprioritization', () => {
  it('prefers an equally-relevant non-USDA candidate over a USDA one', async () => {
    const detected = makeDetected({ name: 'Hähnchenbrust gebraten' });
    mockedSearch.mockResolvedValue([
      makeFood({ id: 'usda-1', name: 'Hähnchenbrust', source: 'usda' }),
      makeFood({ id: 'off-1', name: 'Hähnchenbrust', source: 'off' }),
    ]);

    const results = await matchDetectedFoods([detected]);

    expect(results[0]).toMatchObject({ status: 'db_verified', candidate: { id: 'off-1' } });
  });

  it('still picks a USDA candidate when it is clearly the better name match, not just equal', async () => {
    const detected = makeDetected({ name: 'Hähnchenbrust gebraten' });
    mockedSearch.mockResolvedValue([
      makeFood({ id: 'usda-1', name: 'Hähnchenbrust gebraten', source: 'usda' }),
      makeFood({ id: 'off-1', name: 'Rindfleisch', source: 'off' }),
    ]);

    const results = await matchDetectedFoods([detected]);

    expect(results[0]).toMatchObject({ status: 'db_verified', candidate: { id: 'usda-1' } });
  });
});

describe('matchDetectedFood - raw vs. cooked', () => {
  it('never verifies a cooked detection against the raw entry, however close the rest of the name is', async () => {
    const detected = makeDetected({ name: 'Rindshackfleisch light (5% Fett), gebraten' });
    mockedSearch.mockResolvedValue([
      makeFood({ id: 'raw', name: 'Rindshackfleisch light (5% Fett), roh', source: 'local' }),
      makeFood({ id: 'cooked', name: 'Rindshackfleisch light (5% Fett), gebraten', source: 'local' }),
    ]);

    const results = await matchDetectedFoods([detected]);

    expect(results[0]).toMatchObject({ status: 'db_verified', candidate: { id: 'cooked' }, score: 1 });
  });

  it('falls back to the AI estimate when only the opposite state is in the DB', async () => {
    const detected = makeDetected({ name: 'Rindshackfleisch light (5% Fett)', cookingMethod: 'gebraten' });
    mockedSearch.mockResolvedValue([makeFood({ id: 'raw', name: 'Rindshackfleisch light (5% Fett), roh', source: 'local' })]);

    const results = await matchDetectedFoods([detected]);

    expect(results[0]).toEqual({ status: 'ai_estimate', candidate: null, score: 0 });
  });

  it('matches a Swiss-named detection against the standard-German entry', async () => {
    const detected = makeDetected({ name: 'Pouletbrust, gebraten' });
    mockedSearch.mockResolvedValue([
      makeFood({ id: 'raw', name: 'Hähnchenbrust, roh', source: 'local' }),
      makeFood({ id: 'cooked', name: 'Hähnchenbrust, gebraten', source: 'local' }),
    ]);

    const results = await matchDetectedFoods([detected]);

    expect(results[0]).toMatchObject({ status: 'db_verified', candidate: { id: 'cooked' }, score: 1 });
  });
});

describe('preparationState', () => {
  it('reads the state off whole words only', () => {
    expect(preparationState('Hackfleisch gemischt, roh')).toBe('raw');
    expect(preparationState('Hähnchenbrust, gebraten')).toBe('cooked');
    expect(preparationState('Rohschinken')).toBeNull();
    expect(preparationState('Hähnchenbrust')).toBeNull();
  });
});

describe('correctedValuesFromMatch', () => {
  it('recalculates the full macro/micro profile once the match is confident enough', () => {
    const candidate = makeFood({ servingSize: 100 });
    const match: PhotoMatch = { status: 'db_verified', candidate, score: AUTO_APPLY_MATCH_THRESHOLD };

    const corrected = correctedValuesFromMatch(match);

    expect(corrected?.caloriesPer100g).toBe(165);
    expect(corrected?.macrosPer100g).toEqual({ carbs: 0, protein: 31, fat: 3.6 });
    expect(corrected?.micronutrientsPer100g).toMatchObject({ iron: 0.9, sodium: 74, sugar: 0 });
  });

  it('normalizes a candidate with a non-100g serving size before scaling', () => {
    const candidate = makeFood({ servingSize: 50, caloriesPerServing: 100, macrosPerServing: { carbs: 10, protein: 5, fat: 2 } });
    const corrected = correctedValuesFromMatch({ status: 'db_verified', candidate, score: 0.9 });

    expect(corrected?.caloriesPer100g).toBe(200);
    expect(corrected?.macrosPer100g).toEqual({ carbs: 20, protein: 10, fat: 4 });
  });

  it('refuses below AUTO_APPLY_MATCH_THRESHOLD - the Vision estimate stays untouched', () => {
    const candidate = makeFood();
    const corrected = correctedValuesFromMatch({ status: 'db_verified', candidate, score: AUTO_APPLY_MATCH_THRESHOLD - 0.01 });
    expect(corrected).toBeNull();
  });

  it('refuses with no candidate', () => {
    expect(correctedValuesFromMatch({ status: 'ai_estimate', candidate: null, score: 0 })).toBeNull();
  });
});

describe('nameSimilarity', () => {
  it('scores an exact name match at 1', () => {
    expect(nameSimilarity('Reis', 'Reis')).toBe(1);
  });

  it('scores unrelated names low', () => {
    expect(nameSimilarity('Reis', 'Schokolade')).toBeLessThan(0.2);
  });
});
