import type { FoodItem } from '@/types';

interface LocalFoodSeed {
  id: string;
  name: string;
  caloriesPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  sodiumPer100gMg?: number;
  vitaminCPer100gMg?: number;
}

// Everyday German foods, macros per 100g. Values are standard nutrition-table
// estimates (raw/typical preparation unless noted) - close enough for logging,
// always editable by the user afterwards.
const LOCAL_FOOD_SEEDS: LocalFoodSeed[] = [
  { id: 'local-apfel', name: 'Apfel', caloriesPer100g: 52, carbsPer100g: 14, proteinPer100g: 0.3, fatPer100g: 0.2, fiberPer100g: 2.4, sugarPer100g: 10 },
  { id: 'local-banane', name: 'Banane', caloriesPer100g: 89, carbsPer100g: 23, proteinPer100g: 1.1, fatPer100g: 0.3, fiberPer100g: 2.6, sugarPer100g: 12 },
  { id: 'local-orange', name: 'Orange', caloriesPer100g: 47, carbsPer100g: 12, proteinPer100g: 0.9, fatPer100g: 0.1, fiberPer100g: 2.4, vitaminCPer100gMg: 53 },
  { id: 'local-erdbeeren', name: 'Erdbeeren', caloriesPer100g: 32, carbsPer100g: 8, proteinPer100g: 0.7, fatPer100g: 0.3, fiberPer100g: 2, vitaminCPer100gMg: 59 },
  { id: 'local-blaubeeren', name: 'Blaubeeren', caloriesPer100g: 57, carbsPer100g: 14, proteinPer100g: 0.7, fatPer100g: 0.3, fiberPer100g: 2.4 },
  { id: 'local-traube', name: 'Weintrauben', caloriesPer100g: 69, carbsPer100g: 18, proteinPer100g: 0.7, fatPer100g: 0.2 },
  { id: 'local-wassermelone', name: 'Wassermelone', caloriesPer100g: 30, carbsPer100g: 8, proteinPer100g: 0.6, fatPer100g: 0.2 },
  { id: 'local-avocado', name: 'Avocado', caloriesPer100g: 160, carbsPer100g: 9, proteinPer100g: 2, fatPer100g: 15, fiberPer100g: 7 },
  { id: 'local-vollkornbrot', name: 'Vollkornbrot', caloriesPer100g: 216, carbsPer100g: 40, proteinPer100g: 8, fatPer100g: 2, fiberPer100g: 7 },
  { id: 'local-toastbrot', name: 'Toastbrot', caloriesPer100g: 265, carbsPer100g: 49, proteinPer100g: 8, fatPer100g: 3.5, fiberPer100g: 2.5 },
  { id: 'local-broetchen', name: 'Brötchen', caloriesPer100g: 275, carbsPer100g: 52, proteinPer100g: 9, fatPer100g: 2 },
  { id: 'local-reis', name: 'Reis, gekocht', caloriesPer100g: 130, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3 },
  { id: 'local-vollkornreis', name: 'Vollkornreis, gekocht', caloriesPer100g: 123, carbsPer100g: 26, proteinPer100g: 2.7, fatPer100g: 1, fiberPer100g: 1.8 },
  { id: 'local-nudeln', name: 'Nudeln, gekocht', caloriesPer100g: 158, carbsPer100g: 31, proteinPer100g: 5.8, fatPer100g: 0.9 },
  { id: 'local-vollkornnudeln', name: 'Vollkornnudeln, gekocht', caloriesPer100g: 149, carbsPer100g: 28, proteinPer100g: 6.3, fatPer100g: 1.4, fiberPer100g: 4 },
  { id: 'local-kartoffeln', name: 'Kartoffeln, gekocht', caloriesPer100g: 87, carbsPer100g: 20, proteinPer100g: 1.9, fatPer100g: 0.1 },
  { id: 'local-suesskartoffel', name: 'Süßkartoffel, gekocht', caloriesPer100g: 90, carbsPer100g: 21, proteinPer100g: 2, fatPer100g: 0.1 },
  { id: 'local-pommes', name: 'Pommes frites', caloriesPer100g: 312, carbsPer100g: 41, proteinPer100g: 3.4, fatPer100g: 15 },
  { id: 'local-haferflocken', name: 'Haferflocken', caloriesPer100g: 372, carbsPer100g: 59, proteinPer100g: 13, fatPer100g: 7, fiberPer100g: 10 },
  { id: 'local-muesli', name: 'Müsli', caloriesPer100g: 362, carbsPer100g: 64, proteinPer100g: 9, fatPer100g: 7, fiberPer100g: 8 },
  { id: 'local-cornflakes', name: 'Cornflakes', caloriesPer100g: 378, carbsPer100g: 84, proteinPer100g: 7, fatPer100g: 1, sugarPer100g: 8 },
  { id: 'local-quinoa', name: 'Quinoa, gekocht', caloriesPer100g: 120, carbsPer100g: 21, proteinPer100g: 4.4, fatPer100g: 1.9, fiberPer100g: 2.8 },
  { id: 'local-ei', name: 'Ei, gekocht', caloriesPer100g: 155, carbsPer100g: 1.1, proteinPer100g: 13, fatPer100g: 11 },
  { id: 'local-haehnchenbrust', name: 'Hähnchenbrust, gebraten', caloriesPer100g: 165, carbsPer100g: 0, proteinPer100g: 31, fatPer100g: 3.6 },
  { id: 'local-pute', name: 'Putenbrust', caloriesPer100g: 135, carbsPer100g: 0, proteinPer100g: 29, fatPer100g: 1.7 },
  { id: 'local-rindfleisch', name: 'Rindfleisch, mager', caloriesPer100g: 187, carbsPer100g: 0, proteinPer100g: 26, fatPer100g: 9 },
  { id: 'local-schweinefleisch', name: 'Schweinefleisch, mager', caloriesPer100g: 242, carbsPer100g: 0, proteinPer100g: 27, fatPer100g: 14 },
  { id: 'local-hackfleisch', name: 'Hackfleisch, gemischt', caloriesPer100g: 254, carbsPer100g: 0, proteinPer100g: 18, fatPer100g: 20 },
  { id: 'local-wurst', name: 'Wurst (Brühwurst)', caloriesPer100g: 280, carbsPer100g: 2, proteinPer100g: 13, fatPer100g: 25, sodiumPer100gMg: 900 },
  { id: 'local-speck', name: 'Speck', caloriesPer100g: 541, carbsPer100g: 0.5, proteinPer100g: 12, fatPer100g: 55 },
  { id: 'local-lachs', name: 'Lachs, gegart', caloriesPer100g: 208, carbsPer100g: 0, proteinPer100g: 22, fatPer100g: 13 },
  { id: 'local-thunfisch', name: 'Thunfisch (Dose, im eigenen Saft)', caloriesPer100g: 116, carbsPer100g: 0, proteinPer100g: 26, fatPer100g: 1 },
  { id: 'local-garnelen', name: 'Garnelen, gegart', caloriesPer100g: 99, carbsPer100g: 0.2, proteinPer100g: 21, fatPer100g: 1.4 },
  { id: 'local-tofu', name: 'Tofu', caloriesPer100g: 144, carbsPer100g: 3, proteinPer100g: 15, fatPer100g: 8 },
  { id: 'local-linsen', name: 'Linsen, gekocht', caloriesPer100g: 116, carbsPer100g: 20, proteinPer100g: 9, fatPer100g: 0.4, fiberPer100g: 8 },
  { id: 'local-kichererbsen', name: 'Kichererbsen, gekocht', caloriesPer100g: 164, carbsPer100g: 27, proteinPer100g: 9, fatPer100g: 2.6, fiberPer100g: 8 },
  { id: 'local-bohnen', name: 'Weiße Bohnen, gekocht', caloriesPer100g: 127, carbsPer100g: 23, proteinPer100g: 9, fatPer100g: 0.5, fiberPer100g: 6 },
  { id: 'local-milch', name: 'Milch, 3,5%', caloriesPer100g: 64, carbsPer100g: 4.8, proteinPer100g: 3.4, fatPer100g: 3.5 },
  { id: 'local-magerquark', name: 'Magerquark', caloriesPer100g: 67, carbsPer100g: 4, proteinPer100g: 12, fatPer100g: 0.3 },
  { id: 'local-naturjoghurt', name: 'Naturjoghurt', caloriesPer100g: 61, carbsPer100g: 4.7, proteinPer100g: 3.5, fatPer100g: 3.3 },
  { id: 'local-griechischer-joghurt', name: 'Griechischer Joghurt', caloriesPer100g: 97, carbsPer100g: 4, proteinPer100g: 9, fatPer100g: 5 },
  { id: 'local-kaese-gouda', name: 'Gouda', caloriesPer100g: 356, carbsPer100g: 2.2, proteinPer100g: 25, fatPer100g: 27 },
  { id: 'local-frischkaese', name: 'Frischkäse', caloriesPer100g: 241, carbsPer100g: 3.9, proteinPer100g: 6, fatPer100g: 23 },
  { id: 'local-butter', name: 'Butter', caloriesPer100g: 717, carbsPer100g: 0.1, proteinPer100g: 0.9, fatPer100g: 81 },
  { id: 'local-olivenoel', name: 'Olivenöl', caloriesPer100g: 884, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },
  { id: 'local-brokkoli', name: 'Brokkoli, gekocht', caloriesPer100g: 35, carbsPer100g: 7, proteinPer100g: 2.4, fatPer100g: 0.4, fiberPer100g: 3.3, vitaminCPer100gMg: 65 },
  { id: 'local-tomate', name: 'Tomate', caloriesPer100g: 18, carbsPer100g: 3.9, proteinPer100g: 0.9, fatPer100g: 0.2, vitaminCPer100gMg: 14 },
  { id: 'local-gurke', name: 'Gurke', caloriesPer100g: 15, carbsPer100g: 3.6, proteinPer100g: 0.7, fatPer100g: 0.1 },
  { id: 'local-karotte', name: 'Karotte', caloriesPer100g: 41, carbsPer100g: 10, proteinPer100g: 0.9, fatPer100g: 0.2, fiberPer100g: 2.8 },
  { id: 'local-paprika', name: 'Paprika', caloriesPer100g: 31, carbsPer100g: 6, proteinPer100g: 1, fatPer100g: 0.3, vitaminCPer100gMg: 128 },
  { id: 'local-zwiebel', name: 'Zwiebel', caloriesPer100g: 40, carbsPer100g: 9, proteinPer100g: 1.1, fatPer100g: 0.1 },
  { id: 'local-salat', name: 'Kopfsalat', caloriesPer100g: 15, carbsPer100g: 2.2, proteinPer100g: 1.4, fatPer100g: 0.2 },
  { id: 'local-mandeln', name: 'Mandeln', caloriesPer100g: 579, carbsPer100g: 22, proteinPer100g: 21, fatPer100g: 50, fiberPer100g: 12.5 },
  { id: 'local-walnuesse', name: 'Walnüsse', caloriesPer100g: 654, carbsPer100g: 14, proteinPer100g: 15, fatPer100g: 65, fiberPer100g: 6.7 },
  { id: 'local-erdnussbutter', name: 'Erdnussbutter', caloriesPer100g: 588, carbsPer100g: 20, proteinPer100g: 25, fatPer100g: 50 },
  { id: 'local-honig', name: 'Honig', caloriesPer100g: 304, carbsPer100g: 82, proteinPer100g: 0.3, fatPer100g: 0, sugarPer100g: 82 },
  { id: 'local-zucker', name: 'Zucker', caloriesPer100g: 400, carbsPer100g: 100, proteinPer100g: 0, fatPer100g: 0, sugarPer100g: 100 },
  { id: 'local-schokolade', name: 'Schokolade, Vollmilch', caloriesPer100g: 534, carbsPer100g: 58, proteinPer100g: 7, fatPer100g: 30, sugarPer100g: 56 },
  { id: 'local-chips', name: 'Kartoffelchips', caloriesPer100g: 536, carbsPer100g: 53, proteinPer100g: 6, fatPer100g: 34 },
  { id: 'local-pizza', name: 'Pizza Margherita', caloriesPer100g: 266, carbsPer100g: 33, proteinPer100g: 11, fatPer100g: 10 },
];

export const LOCAL_FOOD_DATABASE: FoodItem[] = LOCAL_FOOD_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  caloriesPerServing: Math.round(seed.caloriesPer100g),
  macrosPerServing: {
    carbs: seed.carbsPer100g,
    protein: seed.proteinPer100g,
    fat: seed.fatPer100g,
  },
  micronutrientsPerServing: {
    fiber: seed.fiberPer100g ?? 0,
    sugar: seed.sugarPer100g ?? 0,
    sodium: seed.sodiumPer100gMg ?? 0,
    vitaminC: seed.vitaminCPer100gMg ?? 0,
  },
  servingSize: 100,
  servingUnit: 'g',
  source: 'local',
}));

/** Lowercase, strips accents/diacritics, and collapses non-alphanumeric runs to single spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      currentRow.push(Math.min(previousRow[j + 1] + 1, currentRow[j] + 1, previousRow[j] + cost));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}

/** True if `word` fuzzy-matches any word in `text` - substring match, or a close typo (edit distance <= 1 for short words, <= 2 for longer ones). */
function fuzzyWordMatch(word: string, text: string): boolean {
  if (text.includes(word)) return true;
  const maxDistance = word.length <= 4 ? 1 : 2;
  return text.split(' ').some((candidate) => Math.abs(candidate.length - word.length) <= maxDistance && levenshteinDistance(word, candidate) <= maxDistance);
}

/** Fuzzy-filters any FoodItem list by name against `query` - shared by the common-foods DB and the recent-foods list. */
export function fuzzyFilterFoodItems<T extends { name: string }>(query: string, items: T[]): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const queryWords = normalizedQuery.split(' ').filter(Boolean);

  return items.filter((item) => {
    const normalizedName = normalizeSearchText(item.name);
    return queryWords.every((word) => fuzzyWordMatch(word, normalizedName));
  });
}

export function searchLocalFoods(query: string): FoodItem[] {
  return fuzzyFilterFoodItems(query, LOCAL_FOOD_DATABASE);
}
