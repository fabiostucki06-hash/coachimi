const mockInsert = jest.fn();
const mockSelectResult = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => mockInsert(table, payload),
      select: () => ({ eq: () => ({ order: () => mockSelectResult(table) }) }),
    }),
  },
}));

import { fetchInboxMealGroupShares, shareMealGroupWithFriend } from '@/services/mealGroupShares';
import { fetchInboxMealShares, shareMealWithFriend } from '@/services/mealShares';
import { sanitizeSharedFoodItem, sanitizeSharedMealType, sanitizeSharedServings, toShareError } from '@/services/sharedMealPayload';
import type { FoodItem } from '@/types';

const food: FoodItem = {
  id: 'local-reis',
  name: 'Reis, gekocht',
  caloriesPerServing: 130,
  macrosPerServing: { carbs: 28, protein: 2.7, fat: 0.3 },
  micronutrientsPerServing: { fiber: 0.4, iron: 0.2 },
  servingSize: 100,
  servingUnit: 'g',
  source: 'local',
};

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockSelectResult.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('sanitizeSharedFoodItem', () => {
  it('passes a complete food item through unchanged', () => {
    expect(sanitizeSharedFoodItem(food)).toEqual(food);
  });

  it('turns null/NaN/missing macros into 0 and drops unusable micronutrients', () => {
    const cleaned = sanitizeSharedFoodItem({
      name: '  Mystery Bowl ',
      caloriesPerServing: null,
      macrosPerServing: { carbs: Number.NaN, protein: '12.5' },
      micronutrientsPerServing: { iron: null, fiber: 3, madeUp: 9, sodium: -5 },
      servingSize: 0,
    });

    expect(cleaned).toEqual({
      id: 'shared-Mystery Bowl',
      name: 'Mystery Bowl',
      caloriesPerServing: 0,
      macrosPerServing: { carbs: 0, protein: 12.5, fat: 0 },
      micronutrientsPerServing: { fiber: 3 },
      servingSize: 100,
      servingUnit: 'g',
    });
  });

  it('copes with macros/micronutrients missing altogether', () => {
    expect(sanitizeSharedFoodItem({ name: 'Apfel' })).toMatchObject({ macrosPerServing: { carbs: 0, protein: 0, fat: 0 }, micronutrientsPerServing: {} });
  });

  it('rejects anything without a name', () => {
    expect(sanitizeSharedFoodItem(null)).toBeNull();
    expect(sanitizeSharedFoodItem('Apfel')).toBeNull();
    expect(sanitizeSharedFoodItem({ name: '  ', caloriesPerServing: 100 })).toBeNull();
  });
});

describe('sanitizeSharedServings / sanitizeSharedMealType', () => {
  it('falls back to one serving and to Snacks', () => {
    expect(sanitizeSharedServings(1.5)).toBe(1.5);
    expect(sanitizeSharedServings('2')).toBe(2);
    expect(sanitizeSharedServings(null)).toBe(1);
    expect(sanitizeSharedServings(0)).toBe(1);
    expect(sanitizeSharedMealType('dinner')).toBe('dinner');
    expect(sanitizeSharedMealType('brunch')).toBe('snack');
  });
});

describe('toShareError', () => {
  it('turns a Supabase error object into a real Error with a usable message', () => {
    expect(toShareError({ code: '42501', message: 'new row violates row-level security policy' }).message).toMatch(/keine bestätigten Freunde/);
    expect(toShareError({ code: 'XX000', message: 'boom' }).message).toBe('boom');
    expect(toShareError(new TypeError('Failed to fetch')).message).toMatch(/Keine Verbindung/);
  });
});

describe('sending', () => {
  it('sends a whole meal as one sanitized meal_group_shares row', async () => {
    await shareMealGroupWithFriend('me', 'friend', 'lunch', [
      { foodItem: food, servings: 1.5 },
      { foodItem: { ...food, name: '' }, servings: 1 },
      { foodItem: { ...food, id: 'x', caloriesPerServing: Number.NaN }, servings: Number.NaN },
    ]);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith('meal_group_shares', {
      from_user_id: 'me',
      to_user_id: 'friend',
      meal_type: 'lunch',
      items: [
        { food_item: food, servings: 1.5 },
        { food_item: { ...food, id: 'x', caloriesPerServing: 0 }, servings: 1 },
      ],
    });
  });

  it('falls back to one meal_shares row per item when the group table does not exist yet', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: 'PGRST205', message: "Could not find the table 'public.meal_group_shares' in the schema cache" } });

    await shareMealGroupWithFriend('me', 'friend', 'breakfast', [
      { foodItem: food, servings: 1 },
      { foodItem: { ...food, id: 'local-ei', name: 'Ei, gekocht' }, servings: 2 },
    ]);

    expect(mockInsert).toHaveBeenLastCalledWith('meal_shares', [
      { from_user_id: 'me', to_user_id: 'friend', food_item: food, meal_type: 'breakfast', servings: 1 },
      { from_user_id: 'me', to_user_id: 'friend', food_item: { ...food, id: 'local-ei', name: 'Ei, gekocht' }, meal_type: 'breakfast', servings: 2 },
    ]);
  });

  it('reports a rejected send as an Error, and refuses a meal with nothing sendable', async () => {
    mockInsert.mockResolvedValue({ error: { code: '42501', message: 'rls' } });
    await expect(shareMealGroupWithFriend('me', 'stranger', 'lunch', [{ foodItem: food, servings: 1 }])).rejects.toThrow(/Freunde/);
    await expect(shareMealWithFriend('me', 'stranger', food, 'lunch', 1)).rejects.toBeInstanceOf(Error);
    await expect(shareMealGroupWithFriend('me', 'friend', 'lunch', [])).rejects.toThrow(/keine Einträge/);
  });
});

describe('receiving', () => {
  it('keeps the usable items of a damaged meal and skips rows with none', async () => {
    mockSelectResult.mockResolvedValue({
      data: [
        {
          id: 's1',
          from_user_id: 'friend',
          to_user_id: 'me',
          meal_type: 'dinner',
          items: [{ food_item: food, servings: 2 }, { food_item: null, servings: 1 }, null, { food_item: { name: 'Sauce', macrosPerServing: null } }],
          created_at: '2026-10-13T10:00:00Z',
        },
        { id: 's2', from_user_id: 'friend', to_user_id: 'me', meal_type: 'dinner', items: null, created_at: '2026-10-13T09:00:00Z' },
      ],
      error: null,
    });

    const shares = await fetchInboxMealGroupShares('me');

    expect(shares).toHaveLength(1);
    expect(shares[0].items.map((item) => [item.foodItem.name, item.servings])).toEqual([
      ['Reis, gekocht', 2],
      ['Sauce', 1],
    ]);
    expect(shares[0].items[1].foodItem.macrosPerServing).toEqual({ carbs: 0, protein: 0, fat: 0 });
  });

  it('treats a missing group table as an empty inbox, not an error', async () => {
    mockSelectResult.mockResolvedValue({ data: null, error: { code: 'PGRST205', message: 'missing' } });
    await expect(fetchInboxMealGroupShares('me')).resolves.toEqual([]);
  });

  it('sanitizes single shares the same way', async () => {
    mockSelectResult.mockResolvedValue({
      data: [
        { id: 'a', from_user_id: 'f', to_user_id: 'me', food_item: food, meal_type: 'elevenses', servings: null, created_at: '' },
        { id: 'b', from_user_id: 'f', to_user_id: 'me', food_item: {}, meal_type: 'lunch', servings: 1, created_at: '' },
      ],
      error: null,
    });

    const shares = await fetchInboxMealShares('me');

    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ id: 'a', mealType: 'snack', servings: 1, foodItem: food });
  });
});
