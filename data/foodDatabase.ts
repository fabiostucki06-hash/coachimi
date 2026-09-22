import type { FoodItem } from '@/types';
import { estimateFructoseFromSugar } from '@/utils/nutritionCalculator';

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
  // Raw/dry and cooked are kept as separate entries rather than one with a
  // "cooked" toggle - cooking absorbs water, so per-100g values genuinely
  // differ (raw is denser/more caloric per gram than the same pasta cooked),
  // and a search for "Nudeln" should surface both explicitly rather than
  // silently picking one preparation state.
  { id: 'local-nudeln-roh', name: 'Nudeln, roh', caloriesPer100g: 371, carbsPer100g: 75, proteinPer100g: 13, fatPer100g: 1.5, fiberPer100g: 3 },
  { id: 'local-nudeln', name: 'Nudeln, gekocht', caloriesPer100g: 158, carbsPer100g: 31, proteinPer100g: 5.8, fatPer100g: 0.9 },
  { id: 'local-vollkornnudeln-roh', name: 'Vollkornnudeln, roh', caloriesPer100g: 348, carbsPer100g: 66, proteinPer100g: 14, fatPer100g: 2.5, fiberPer100g: 9 },
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

  // Obst
  { id: 'local-birne', name: 'Birne', caloriesPer100g: 57, carbsPer100g: 15, proteinPer100g: 0.4, fatPer100g: 0.1, fiberPer100g: 3.1, sugarPer100g: 10 },
  { id: 'local-pfirsich', name: 'Pfirsich', caloriesPer100g: 39, carbsPer100g: 10, proteinPer100g: 0.9, fatPer100g: 0.3, fiberPer100g: 1.5, sugarPer100g: 8.4 },
  { id: 'local-aprikose', name: 'Aprikose', caloriesPer100g: 48, carbsPer100g: 11, proteinPer100g: 1.4, fatPer100g: 0.4, fiberPer100g: 2, sugarPer100g: 9 },
  { id: 'local-kiwi', name: 'Kiwi', caloriesPer100g: 61, carbsPer100g: 15, proteinPer100g: 1.1, fatPer100g: 0.5, fiberPer100g: 3, vitaminCPer100gMg: 93 },
  { id: 'local-ananas', name: 'Ananas', caloriesPer100g: 50, carbsPer100g: 13, proteinPer100g: 0.5, fatPer100g: 0.1, fiberPer100g: 1.4 },
  { id: 'local-mango', name: 'Mango', caloriesPer100g: 60, carbsPer100g: 15, proteinPer100g: 0.8, fatPer100g: 0.4, fiberPer100g: 1.6, vitaminCPer100gMg: 36 },
  { id: 'local-papaya', name: 'Papaya', caloriesPer100g: 43, carbsPer100g: 11, proteinPer100g: 0.5, fatPer100g: 0.3, vitaminCPer100gMg: 61 },
  { id: 'local-kirschen', name: 'Kirschen', caloriesPer100g: 63, carbsPer100g: 16, proteinPer100g: 1.1, fatPer100g: 0.2, fiberPer100g: 2.1 },
  { id: 'local-pflaumen', name: 'Pflaumen', caloriesPer100g: 46, carbsPer100g: 11, proteinPer100g: 0.7, fatPer100g: 0.3, fiberPer100g: 1.4 },
  { id: 'local-nektarine', name: 'Nektarine', caloriesPer100g: 44, carbsPer100g: 10, proteinPer100g: 1.1, fatPer100g: 0.3 },
  { id: 'local-grapefruit', name: 'Grapefruit', caloriesPer100g: 42, carbsPer100g: 11, proteinPer100g: 0.8, fatPer100g: 0.1, vitaminCPer100gMg: 31 },
  { id: 'local-zitrone', name: 'Zitrone', caloriesPer100g: 29, carbsPer100g: 9, proteinPer100g: 1.1, fatPer100g: 0.3, vitaminCPer100gMg: 53 },
  { id: 'local-limette', name: 'Limette', caloriesPer100g: 30, carbsPer100g: 11, proteinPer100g: 0.7, fatPer100g: 0.2, vitaminCPer100gMg: 30 },
  { id: 'local-feigen', name: 'Feigen', caloriesPer100g: 74, carbsPer100g: 19, proteinPer100g: 0.8, fatPer100g: 0.3, fiberPer100g: 2.9 },
  { id: 'local-datteln', name: 'Datteln, getrocknet', caloriesPer100g: 277, carbsPer100g: 75, proteinPer100g: 2, fatPer100g: 0.4, fiberPer100g: 8, sugarPer100g: 63 },
  { id: 'local-rosinen', name: 'Rosinen', caloriesPer100g: 299, carbsPer100g: 79, proteinPer100g: 3, fatPer100g: 0.5, fiberPer100g: 4, sugarPer100g: 59 },
  { id: 'local-granatapfel', name: 'Granatapfel', caloriesPer100g: 83, carbsPer100g: 19, proteinPer100g: 1.7, fatPer100g: 1.2, fiberPer100g: 4 },
  { id: 'local-himbeeren', name: 'Himbeeren', caloriesPer100g: 52, carbsPer100g: 12, proteinPer100g: 1.2, fatPer100g: 0.7, fiberPer100g: 6.5 },
  { id: 'local-brombeeren', name: 'Brombeeren', caloriesPer100g: 43, carbsPer100g: 10, proteinPer100g: 1.4, fatPer100g: 0.5, fiberPer100g: 5.3 },
  { id: 'local-johannisbeeren', name: 'Johannisbeeren, rot', caloriesPer100g: 56, carbsPer100g: 13, proteinPer100g: 1.4, fatPer100g: 0.2, vitaminCPer100gMg: 41 },
  { id: 'local-stachelbeeren', name: 'Stachelbeeren', caloriesPer100g: 44, carbsPer100g: 10, proteinPer100g: 0.9, fatPer100g: 0.6, vitaminCPer100gMg: 28 },
  { id: 'local-mandarine', name: 'Mandarine', caloriesPer100g: 53, carbsPer100g: 13, proteinPer100g: 0.8, fatPer100g: 0.3, vitaminCPer100gMg: 27 },
  { id: 'local-litchi', name: 'Litchi', caloriesPer100g: 66, carbsPer100g: 17, proteinPer100g: 0.8, fatPer100g: 0.4 },
  { id: 'local-kaki', name: 'Kaki', caloriesPer100g: 70, carbsPer100g: 19, proteinPer100g: 0.6, fatPer100g: 0.2 },

  // Gemüse
  { id: 'local-blumenkohl', name: 'Blumenkohl, gekocht', caloriesPer100g: 25, carbsPer100g: 5, proteinPer100g: 2, fatPer100g: 0.3, fiberPer100g: 2 },
  { id: 'local-rosenkohl', name: 'Rosenkohl, gekocht', caloriesPer100g: 43, carbsPer100g: 9, proteinPer100g: 3.4, fatPer100g: 0.3, fiberPer100g: 3.8 },
  { id: 'local-spinat-roh', name: 'Spinat, roh', caloriesPer100g: 23, carbsPer100g: 3.6, proteinPer100g: 2.9, fatPer100g: 0.4, fiberPer100g: 2.2 },
  { id: 'local-spinat-gekocht', name: 'Spinat, gekocht', caloriesPer100g: 23, carbsPer100g: 3.8, proteinPer100g: 3, fatPer100g: 0.3 },
  { id: 'local-gruenkohl', name: 'Grünkohl, gekocht', caloriesPer100g: 49, carbsPer100g: 7, proteinPer100g: 4.3, fatPer100g: 0.9, fiberPer100g: 4 },
  { id: 'local-zucchini', name: 'Zucchini', caloriesPer100g: 17, carbsPer100g: 3.1, proteinPer100g: 1.2, fatPer100g: 0.3 },
  { id: 'local-aubergine', name: 'Aubergine, gekocht', caloriesPer100g: 25, carbsPer100g: 6, proteinPer100g: 1, fatPer100g: 0.2, fiberPer100g: 3 },
  { id: 'local-zuckermais', name: 'Zuckermais', caloriesPer100g: 96, carbsPer100g: 19, proteinPer100g: 3.4, fatPer100g: 1.5, fiberPer100g: 2.7 },
  { id: 'local-erbsen', name: 'Erbsen, gekocht', caloriesPer100g: 81, carbsPer100g: 14, proteinPer100g: 5.4, fatPer100g: 0.4, fiberPer100g: 5 },
  { id: 'local-spargel', name: 'Spargel, gekocht', caloriesPer100g: 20, carbsPer100g: 3.4, proteinPer100g: 2.2, fatPer100g: 0.2 },
  { id: 'local-rote-bete', name: 'Rote Bete, gekocht', caloriesPer100g: 44, carbsPer100g: 10, proteinPer100g: 1.7, fatPer100g: 0.2 },
  { id: 'local-staudensellerie', name: 'Staudensellerie', caloriesPer100g: 16, carbsPer100g: 3, proteinPer100g: 0.7, fatPer100g: 0.2 },
  { id: 'local-fenchel', name: 'Fenchel', caloriesPer100g: 31, carbsPer100g: 7, proteinPer100g: 1.2, fatPer100g: 0.2 },
  { id: 'local-lauch', name: 'Lauch / Porree', caloriesPer100g: 61, carbsPer100g: 14, proteinPer100g: 1.5, fatPer100g: 0.3 },
  { id: 'local-champignons', name: 'Champignons', caloriesPer100g: 22, carbsPer100g: 3.3, proteinPer100g: 3.1, fatPer100g: 0.3 },
  { id: 'local-radieschen', name: 'Radieschen', caloriesPer100g: 16, carbsPer100g: 3.4, proteinPer100g: 0.7, fatPer100g: 0.1 },
  { id: 'local-kuerbis', name: 'Kürbis (Hokkaido)', caloriesPer100g: 26, carbsPer100g: 6.5, proteinPer100g: 1, fatPer100g: 0.1 },
  { id: 'local-rotkohl', name: 'Rotkohl', caloriesPer100g: 26, carbsPer100g: 5.6, proteinPer100g: 1.4, fatPer100g: 0.2 },
  { id: 'local-weisskohl', name: 'Weißkohl', caloriesPer100g: 25, carbsPer100g: 5.8, proteinPer100g: 1.3, fatPer100g: 0.1 },
  { id: 'local-chinakohl', name: 'Chinakohl', caloriesPer100g: 13, carbsPer100g: 2.2, proteinPer100g: 1.2, fatPer100g: 0.2 },
  { id: 'local-mangold', name: 'Mangold', caloriesPer100g: 19, carbsPer100g: 3.7, proteinPer100g: 1.8, fatPer100g: 0.2 },
  { id: 'local-rucola', name: 'Rucola', caloriesPer100g: 25, carbsPer100g: 3.7, proteinPer100g: 2.6, fatPer100g: 0.7, vitaminCPer100gMg: 15 },
  { id: 'local-feldsalat', name: 'Feldsalat', caloriesPer100g: 14, carbsPer100g: 0.8, proteinPer100g: 2, fatPer100g: 0.4, vitaminCPer100gMg: 35 },
  { id: 'local-eisbergsalat', name: 'Eisbergsalat', caloriesPer100g: 14, carbsPer100g: 3, proteinPer100g: 0.9, fatPer100g: 0.1 },
  { id: 'local-oliven-gruen', name: 'Oliven, grün', caloriesPer100g: 145, carbsPer100g: 3.8, proteinPer100g: 1, fatPer100g: 15 },
  { id: 'local-oliven-schwarz', name: 'Oliven, schwarz', caloriesPer100g: 115, carbsPer100g: 6, proteinPer100g: 0.8, fatPer100g: 11 },
  { id: 'local-peperoni', name: 'Peperoni', caloriesPer100g: 40, carbsPer100g: 9, proteinPer100g: 2, fatPer100g: 0.4, vitaminCPer100gMg: 144 },

  // Getreide & Kohlenhydrate
  { id: 'local-bulgur', name: 'Bulgur, gekocht', caloriesPer100g: 83, carbsPer100g: 19, proteinPer100g: 3, fatPer100g: 0.2, fiberPer100g: 4.5 },
  { id: 'local-couscous', name: 'Couscous, gekocht', caloriesPer100g: 112, carbsPer100g: 23, proteinPer100g: 3.8, fatPer100g: 0.2 },
  { id: 'local-hirse', name: 'Hirse, gekocht', caloriesPer100g: 119, carbsPer100g: 23, proteinPer100g: 3.5, fatPer100g: 1 },
  { id: 'local-buchweizen', name: 'Buchweizen, gekocht', caloriesPer100g: 92, carbsPer100g: 20, proteinPer100g: 3.4, fatPer100g: 0.6, fiberPer100g: 2.7 },
  { id: 'local-gerste', name: 'Gerste, gekocht', caloriesPer100g: 123, carbsPer100g: 28, proteinPer100g: 2.3, fatPer100g: 0.4 },
  { id: 'local-roggenbrot', name: 'Roggenbrot', caloriesPer100g: 200, carbsPer100g: 41, proteinPer100g: 6.5, fatPer100g: 1.2, fiberPer100g: 6 },
  { id: 'local-dinkelbrot', name: 'Dinkelbrot', caloriesPer100g: 220, carbsPer100g: 40, proteinPer100g: 8, fatPer100g: 2.5, fiberPer100g: 6 },
  { id: 'local-sauerteigbrot', name: 'Sauerteigbrot', caloriesPer100g: 210, carbsPer100g: 42, proteinPer100g: 7, fatPer100g: 1.5 },
  { id: 'local-knaeckebrot', name: 'Knäckebrot', caloriesPer100g: 355, carbsPer100g: 70, proteinPer100g: 9, fatPer100g: 2.5, fiberPer100g: 12 },
  { id: 'local-baguette', name: 'Baguette', caloriesPer100g: 274, carbsPer100g: 55, proteinPer100g: 9, fatPer100g: 1.4 },
  { id: 'local-croissant', name: 'Croissant', caloriesPer100g: 406, carbsPer100g: 46, proteinPer100g: 8, fatPer100g: 21 },
  { id: 'local-pfannkuchen', name: 'Pfannkuchen', caloriesPer100g: 227, carbsPer100g: 28, proteinPer100g: 6, fatPer100g: 9 },
  { id: 'local-waffeln', name: 'Waffeln', caloriesPer100g: 291, carbsPer100g: 41, proteinPer100g: 6, fatPer100g: 11, sugarPer100g: 15 },
  { id: 'local-bagel', name: 'Bagel', caloriesPer100g: 257, carbsPer100g: 49, proteinPer100g: 10, fatPer100g: 1.7 },
  { id: 'local-tortilla-weizen', name: 'Tortilla, Weizen', caloriesPer100g: 218, carbsPer100g: 36, proteinPer100g: 6, fatPer100g: 5 },
  { id: 'local-maistortilla', name: 'Maistortilla', caloriesPer100g: 210, carbsPer100g: 44, proteinPer100g: 5.7, fatPer100g: 2.9 },
  { id: 'local-reiswaffeln', name: 'Reiswaffeln', caloriesPer100g: 387, carbsPer100g: 81, proteinPer100g: 8, fatPer100g: 2.8 },
  { id: 'local-popcorn-natur', name: 'Popcorn, ungesüßt', caloriesPer100g: 387, carbsPer100g: 78, proteinPer100g: 12, fatPer100g: 5, fiberPer100g: 15 },
  { id: 'local-griess', name: 'Grieß, gekocht', caloriesPer100g: 71, carbsPer100g: 15, proteinPer100g: 2, fatPer100g: 0.2 },
  { id: 'local-polenta', name: 'Polenta, gekocht', caloriesPer100g: 85, carbsPer100g: 18, proteinPer100g: 2, fatPer100g: 0.5 },
  { id: 'local-kartoffelpueree', name: 'Kartoffelpüree', caloriesPer100g: 105, carbsPer100g: 16, proteinPer100g: 2, fatPer100g: 4 },
  { id: 'local-kartoffelkloesse', name: 'Kartoffelknödel', caloriesPer100g: 130, carbsPer100g: 26, proteinPer100g: 3, fatPer100g: 1 },
  { id: 'local-spaetzle', name: 'Spätzle', caloriesPer100g: 168, carbsPer100g: 30, proteinPer100g: 6.5, fatPer100g: 2.5 },
  { id: 'local-ramen', name: 'Ramen-Nudeln, gekocht', caloriesPer100g: 188, carbsPer100g: 27, proteinPer100g: 5, fatPer100g: 6.7, sodiumPer100gMg: 500 },
  { id: 'local-vollkorntoast', name: 'Vollkorn-Toastbrot', caloriesPer100g: 250, carbsPer100g: 45, proteinPer100g: 10, fatPer100g: 3.5, fiberPer100g: 6.5 },

  // Protein: Fleisch, Fisch, Eier
  { id: 'local-ei-roh', name: 'Ei, roh', caloriesPer100g: 155, carbsPer100g: 1.1, proteinPer100g: 13, fatPer100g: 11 },
  { id: 'local-eiklar', name: 'Eiweiß / Eiklar', caloriesPer100g: 52, carbsPer100g: 0.7, proteinPer100g: 11, fatPer100g: 0.2 },
  { id: 'local-haehnchenschenkel', name: 'Hähnchenschenkel, gebraten', caloriesPer100g: 216, carbsPer100g: 0, proteinPer100g: 26, fatPer100g: 12 },
  { id: 'local-haehnchen-haut', name: 'Hähnchen mit Haut, gebraten', caloriesPer100g: 250, carbsPer100g: 0, proteinPer100g: 27, fatPer100g: 15 },
  { id: 'local-pute-aufschnitt', name: 'Pute, Aufschnitt', caloriesPer100g: 106, carbsPer100g: 1, proteinPer100g: 20, fatPer100g: 2 },
  { id: 'local-kalbfleisch', name: 'Kalbfleisch, mager', caloriesPer100g: 172, carbsPer100g: 0, proteinPer100g: 24, fatPer100g: 8 },
  { id: 'local-lammfleisch', name: 'Lammfleisch', caloriesPer100g: 294, carbsPer100g: 0, proteinPer100g: 25, fatPer100g: 21 },
  { id: 'local-leberwurst', name: 'Leberwurst', caloriesPer100g: 326, carbsPer100g: 2, proteinPer100g: 14, fatPer100g: 30, sodiumPer100gMg: 900 },
  { id: 'local-salami', name: 'Salami', caloriesPer100g: 407, carbsPer100g: 1.5, proteinPer100g: 22, fatPer100g: 35, sodiumPer100gMg: 1500 },
  { id: 'local-schinken-gekocht', name: 'Schinken, gekocht', caloriesPer100g: 145, carbsPer100g: 1, proteinPer100g: 20, fatPer100g: 6, sodiumPer100gMg: 1100 },
  { id: 'local-parmaschinken', name: 'Parmaschinken', caloriesPer100g: 268, carbsPer100g: 0.3, proteinPer100g: 25, fatPer100g: 18, sodiumPer100gMg: 2000 },
  { id: 'local-kabeljau', name: 'Kabeljau, gegart', caloriesPer100g: 105, carbsPer100g: 0, proteinPer100g: 23, fatPer100g: 1 },
  { id: 'local-seelachs', name: 'Seelachs, gegart', caloriesPer100g: 105, carbsPer100g: 0, proteinPer100g: 22, fatPer100g: 1.3 },
  { id: 'local-forelle', name: 'Forelle, gegart', caloriesPer100g: 148, carbsPer100g: 0, proteinPer100g: 21, fatPer100g: 6.6 },
  { id: 'local-makrele', name: 'Makrele, geräuchert', caloriesPer100g: 262, carbsPer100g: 0, proteinPer100g: 19, fatPer100g: 21 },
  { id: 'local-hering', name: 'Hering', caloriesPer100g: 158, carbsPer100g: 0, proteinPer100g: 18, fatPer100g: 9 },
  { id: 'local-sardinen', name: 'Sardinen in Öl', caloriesPer100g: 208, carbsPer100g: 0, proteinPer100g: 25, fatPer100g: 11 },
  { id: 'local-krebsfleisch', name: 'Krebsfleisch / Krabben', caloriesPer100g: 97, carbsPer100g: 0, proteinPer100g: 19, fatPer100g: 1.5 },
  { id: 'local-muscheln', name: 'Muscheln', caloriesPer100g: 86, carbsPer100g: 3.7, proteinPer100g: 12, fatPer100g: 2.2 },
  { id: 'local-tintenfisch', name: 'Tintenfisch (Calamari), gegart', caloriesPer100g: 175, carbsPer100g: 8, proteinPer100g: 18, fatPer100g: 8 },
  { id: 'local-tempeh', name: 'Tempeh', caloriesPer100g: 193, carbsPer100g: 9, proteinPer100g: 19, fatPer100g: 11 },
  { id: 'local-seitan', name: 'Seitan', caloriesPer100g: 370, carbsPer100g: 14, proteinPer100g: 75, fatPer100g: 2 },
  { id: 'local-edamame', name: 'Edamame, gekocht', caloriesPer100g: 122, carbsPer100g: 9, proteinPer100g: 11, fatPer100g: 5, fiberPer100g: 5 },

  // Milchprodukte
  { id: 'local-vollmilch', name: 'Vollmilch, 3,8%', caloriesPer100g: 66, carbsPer100g: 4.8, proteinPer100g: 3.3, fatPer100g: 3.8 },
  { id: 'local-rohmilch', name: 'Rohmilch', caloriesPer100g: 66, carbsPer100g: 4.8, proteinPer100g: 3.3, fatPer100g: 3.9 },
  { id: 'local-fettarme-milch', name: 'Fettarme Milch, 1,5%', caloriesPer100g: 47, carbsPer100g: 4.9, proteinPer100g: 3.4, fatPer100g: 1.5 },
  { id: 'local-buttermilch', name: 'Buttermilch', caloriesPer100g: 40, carbsPer100g: 4.8, proteinPer100g: 3.4, fatPer100g: 0.5 },
  { id: 'local-kondensmilch', name: 'Kondensmilch', caloriesPer100g: 135, carbsPer100g: 10, proteinPer100g: 7, fatPer100g: 8 },
  { id: 'local-sahne', name: 'Sahne, 30%', caloriesPer100g: 292, carbsPer100g: 3.4, proteinPer100g: 2.5, fatPer100g: 30 },
  { id: 'local-schlagsahne', name: 'Schlagsahne, geschlagen', caloriesPer100g: 309, carbsPer100g: 3, proteinPer100g: 2.2, fatPer100g: 33 },
  { id: 'local-creme-fraiche', name: 'Crème fraîche', caloriesPer100g: 292, carbsPer100g: 3.4, proteinPer100g: 2.4, fatPer100g: 30 },
  { id: 'local-saure-sahne', name: 'Saure Sahne', caloriesPer100g: 165, carbsPer100g: 4, proteinPer100g: 3, fatPer100g: 15 },
  { id: 'local-skyr', name: 'Skyr', caloriesPer100g: 63, carbsPer100g: 4, proteinPer100g: 11, fatPer100g: 0.2 },
  { id: 'local-kefir', name: 'Kefir', caloriesPer100g: 41, carbsPer100g: 4, proteinPer100g: 3.4, fatPer100g: 1 },
  { id: 'local-huettenkaese', name: 'Hüttenkäse', caloriesPer100g: 98, carbsPer100g: 3, proteinPer100g: 12, fatPer100g: 4.3 },
  { id: 'local-mozzarella', name: 'Mozzarella', caloriesPer100g: 280, carbsPer100g: 2.2, proteinPer100g: 22, fatPer100g: 21 },
  { id: 'local-parmesan', name: 'Parmesan', caloriesPer100g: 392, carbsPer100g: 0, proteinPer100g: 36, fatPer100g: 26, sodiumPer100gMg: 1500 },
  { id: 'local-feta', name: 'Feta', caloriesPer100g: 264, carbsPer100g: 4, proteinPer100g: 14, fatPer100g: 21, sodiumPer100gMg: 1300 },
  { id: 'local-camembert', name: 'Camembert', caloriesPer100g: 300, carbsPer100g: 0.5, proteinPer100g: 20, fatPer100g: 24 },
  { id: 'local-edamer', name: 'Edamer', caloriesPer100g: 350, carbsPer100g: 0, proteinPer100g: 26, fatPer100g: 27 },
  { id: 'local-mascarpone', name: 'Mascarpone', caloriesPer100g: 450, carbsPer100g: 3, proteinPer100g: 5, fatPer100g: 47 },
  { id: 'local-ricotta', name: 'Ricotta', caloriesPer100g: 174, carbsPer100g: 3, proteinPer100g: 11, fatPer100g: 13 },
  { id: 'local-schmelzkaese', name: 'Schmelzkäse', caloriesPer100g: 280, carbsPer100g: 4, proteinPer100g: 15, fatPer100g: 23, sodiumPer100gMg: 1300 },
  { id: 'local-kondensmilch-gezuckert', name: 'Kondensmilch, gezuckert', caloriesPer100g: 321, carbsPer100g: 55, proteinPer100g: 8, fatPer100g: 8.7, sugarPer100g: 55 },

  // Pflanzliche Alternativen
  { id: 'local-hafermilch', name: 'Hafermilch', caloriesPer100g: 47, carbsPer100g: 6.5, proteinPer100g: 1, fatPer100g: 1.5 },
  { id: 'local-mandelmilch', name: 'Mandelmilch', caloriesPer100g: 24, carbsPer100g: 3, proteinPer100g: 0.5, fatPer100g: 1.1 },
  { id: 'local-sojamilch', name: 'Sojamilch', caloriesPer100g: 33, carbsPer100g: 1, proteinPer100g: 3, fatPer100g: 1.8 },
  { id: 'local-sojajoghurt', name: 'Sojajoghurt', caloriesPer100g: 59, carbsPer100g: 4, proteinPer100g: 4, fatPer100g: 2.5 },
  { id: 'local-veganer-kaese', name: 'Veganer Käse', caloriesPer100g: 290, carbsPer100g: 5, proteinPer100g: 1, fatPer100g: 27 },
  { id: 'local-veganer-aufschnitt', name: 'Veganer Aufschnitt', caloriesPer100g: 180, carbsPer100g: 6, proteinPer100g: 15, fatPer100g: 10 },

  // Nüsse & Samen
  { id: 'local-cashewkerne', name: 'Cashewkerne', caloriesPer100g: 553, carbsPer100g: 30, proteinPer100g: 18, fatPer100g: 44, fiberPer100g: 3.3 },
  { id: 'local-pistazien', name: 'Pistazien', caloriesPer100g: 560, carbsPer100g: 28, proteinPer100g: 20, fatPer100g: 45, fiberPer100g: 10 },
  { id: 'local-haselnuesse', name: 'Haselnüsse', caloriesPer100g: 628, carbsPer100g: 17, proteinPer100g: 15, fatPer100g: 61, fiberPer100g: 9.7 },
  { id: 'local-paranuesse', name: 'Paranüsse', caloriesPer100g: 656, carbsPer100g: 12, proteinPer100g: 14, fatPer100g: 66, fiberPer100g: 7.5 },
  { id: 'local-macadamianuesse', name: 'Macadamianüsse', caloriesPer100g: 718, carbsPer100g: 14, proteinPer100g: 8, fatPer100g: 76, fiberPer100g: 8.6 },
  { id: 'local-pekannuesse', name: 'Pekannüsse', caloriesPer100g: 691, carbsPer100g: 14, proteinPer100g: 9, fatPer100g: 72, fiberPer100g: 9.6 },
  { id: 'local-kuerbiskerne', name: 'Kürbiskerne', caloriesPer100g: 559, carbsPer100g: 11, proteinPer100g: 30, fatPer100g: 49, fiberPer100g: 6 },
  { id: 'local-sonnenblumenkerne', name: 'Sonnenblumenkerne', caloriesPer100g: 584, carbsPer100g: 20, proteinPer100g: 21, fatPer100g: 51, fiberPer100g: 8.6 },
  { id: 'local-chiasamen', name: 'Chiasamen', caloriesPer100g: 486, carbsPer100g: 42, proteinPer100g: 17, fatPer100g: 31, fiberPer100g: 34 },
  { id: 'local-leinsamen', name: 'Leinsamen', caloriesPer100g: 534, carbsPer100g: 29, proteinPer100g: 18, fatPer100g: 42, fiberPer100g: 27 },
  { id: 'local-sesam', name: 'Sesam', caloriesPer100g: 573, carbsPer100g: 23, proteinPer100g: 18, fatPer100g: 50, fiberPer100g: 12 },
  { id: 'local-kokosraspeln', name: 'Kokosraspeln', caloriesPer100g: 660, carbsPer100g: 7, proteinPer100g: 7, fatPer100g: 65, fiberPer100g: 16 },
  { id: 'local-studentenfutter', name: 'Studentenfutter', caloriesPer100g: 480, carbsPer100g: 35, proteinPer100g: 15, fatPer100g: 32, fiberPer100g: 7 },

  // Öle & Fette
  { id: 'local-rapsoel', name: 'Rapsöl', caloriesPer100g: 884, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },
  { id: 'local-kokosoel', name: 'Kokosöl', caloriesPer100g: 862, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },
  { id: 'local-sonnenblumenoel', name: 'Sonnenblumenöl', caloriesPer100g: 884, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },
  { id: 'local-sesamoel', name: 'Sesamöl', caloriesPer100g: 884, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },
  { id: 'local-margarine', name: 'Margarine', caloriesPer100g: 717, carbsPer100g: 0.5, proteinPer100g: 0.2, fatPer100g: 80 },
  { id: 'local-schmalz', name: 'Schmalz', caloriesPer100g: 897, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 100 },

  // Süßes & Snacks
  { id: 'local-zartbitterschokolade', name: 'Zartbitterschokolade', caloriesPer100g: 546, carbsPer100g: 46, proteinPer100g: 5, fatPer100g: 35, sugarPer100g: 40 },
  { id: 'local-weisse-schokolade', name: 'Weiße Schokolade', caloriesPer100g: 539, carbsPer100g: 59, proteinPer100g: 6, fatPer100g: 32, sugarPer100g: 59 },
  { id: 'local-nussnougatcreme', name: 'Nuss-Nougat-Creme', caloriesPer100g: 539, carbsPer100g: 57, proteinPer100g: 6, fatPer100g: 31, sugarPer100g: 56 },
  { id: 'local-gummibaerchen', name: 'Gummibärchen', caloriesPer100g: 343, carbsPer100g: 77, proteinPer100g: 6.9, fatPer100g: 0.3, sugarPer100g: 46 },
  { id: 'local-salzstangen', name: 'Salzstangen', caloriesPer100g: 380, carbsPer100g: 75, proteinPer100g: 10, fatPer100g: 3, sodiumPer100gMg: 1400 },
  { id: 'local-popcorn-suess', name: 'Popcorn, süß', caloriesPer100g: 480, carbsPer100g: 66, proteinPer100g: 5, fatPer100g: 20, sugarPer100g: 34 },
  { id: 'local-eis-vanille', name: 'Eis, Vanille', caloriesPer100g: 207, carbsPer100g: 24, proteinPer100g: 3.5, fatPer100g: 11, sugarPer100g: 21 },
  { id: 'local-ruehrkuchen', name: 'Rührkuchen', caloriesPer100g: 371, carbsPer100g: 51, proteinPer100g: 5, fatPer100g: 16, sugarPer100g: 30 },
  { id: 'local-donut', name: 'Donut', caloriesPer100g: 452, carbsPer100g: 51, proteinPer100g: 5, fatPer100g: 25, sugarPer100g: 23 },
  { id: 'local-butterkekse', name: 'Butterkekse', caloriesPer100g: 480, carbsPer100g: 68, proteinPer100g: 6, fatPer100g: 20, sugarPer100g: 25 },
  { id: 'local-muesliriegel', name: 'Müsliriegel', caloriesPer100g: 410, carbsPer100g: 60, proteinPer100g: 7, fatPer100g: 15, sugarPer100g: 30 },
  { id: 'local-marmelade', name: 'Marmelade', caloriesPer100g: 250, carbsPer100g: 62, proteinPer100g: 0.5, fatPer100g: 0.1, sugarPer100g: 60 },
  { id: 'local-vanillepudding', name: 'Vanillepudding', caloriesPer100g: 120, carbsPer100g: 18, proteinPer100g: 3, fatPer100g: 4, sugarPer100g: 15 },
  { id: 'local-schokopudding', name: 'Schokopudding', caloriesPer100g: 135, carbsPer100g: 20, proteinPer100g: 3.5, fatPer100g: 4.5, sugarPer100g: 17 },
  { id: 'local-trockenfruechte', name: 'Trockenfrüchte, gemischt', caloriesPer100g: 320, carbsPer100g: 68, proteinPer100g: 3, fatPer100g: 0.5, fiberPer100g: 8, sugarPer100g: 55 },

  // Getränke
  { id: 'local-cola', name: 'Cola', caloriesPer100g: 42, carbsPer100g: 10.6, proteinPer100g: 0, fatPer100g: 0, sugarPer100g: 10.6 },
  { id: 'local-orangensaft', name: 'Orangensaft', caloriesPer100g: 45, carbsPer100g: 10, proteinPer100g: 0.7, fatPer100g: 0.2, vitaminCPer100gMg: 40 },
  { id: 'local-apfelsaft', name: 'Apfelsaft', caloriesPer100g: 46, carbsPer100g: 11, proteinPer100g: 0.1, fatPer100g: 0.1 },
  { id: 'local-bier', name: 'Bier (Pils)', caloriesPer100g: 43, carbsPer100g: 3.5, proteinPer100g: 0.5, fatPer100g: 0 },
  { id: 'local-wein-rot', name: 'Wein, rot', caloriesPer100g: 85, carbsPer100g: 2.6, proteinPer100g: 0.1, fatPer100g: 0 },
  { id: 'local-wein-weiss', name: 'Wein, weiß', caloriesPer100g: 82, carbsPer100g: 2.6, proteinPer100g: 0.1, fatPer100g: 0 },
  { id: 'local-energy-drink', name: 'Energy Drink', caloriesPer100g: 45, carbsPer100g: 11, proteinPer100g: 0, fatPer100g: 0, sugarPer100g: 11 },
  { id: 'local-kaffee-schwarz', name: 'Kaffee, schwarz', caloriesPer100g: 1, carbsPer100g: 0, proteinPer100g: 0.1, fatPer100g: 0 },
  { id: 'local-kaffee-milch', name: 'Kaffee mit Milch', caloriesPer100g: 15, carbsPer100g: 1.5, proteinPer100g: 0.8, fatPer100g: 0.6 },
  { id: 'local-tee', name: 'Tee, ungesüßt', caloriesPer100g: 1, carbsPer100g: 0, proteinPer100g: 0, fatPer100g: 0 },
  { id: 'local-kakao', name: 'Kakao (Getränk mit Milch)', caloriesPer100g: 75, carbsPer100g: 10, proteinPer100g: 3.5, fatPer100g: 2.5, sugarPer100g: 9 },

  // Fertiggerichte & Fastfood
  { id: 'local-cheeseburger', name: 'Cheeseburger', caloriesPer100g: 250, carbsPer100g: 22, proteinPer100g: 13, fatPer100g: 12 },
  { id: 'local-doener', name: 'Döner Kebab', caloriesPer100g: 240, carbsPer100g: 20, proteinPer100g: 13, fatPer100g: 12 },
  { id: 'local-sushi-lachs', name: 'Sushi (Lachs-Nigiri)', caloriesPer100g: 150, carbsPer100g: 25, proteinPer100g: 6, fatPer100g: 2.5 },
  { id: 'local-currywurst-pommes', name: 'Currywurst mit Pommes', caloriesPer100g: 220, carbsPer100g: 20, proteinPer100g: 7, fatPer100g: 13 },
  { id: 'local-lasagne', name: 'Lasagne', caloriesPer100g: 155, carbsPer100g: 13, proteinPer100g: 8, fatPer100g: 7.5 },
  { id: 'local-gulasch', name: 'Gulasch', caloriesPer100g: 140, carbsPer100g: 4, proteinPer100g: 15, fatPer100g: 7 },
  { id: 'local-chili-con-carne', name: 'Chili con Carne', caloriesPer100g: 130, carbsPer100g: 10, proteinPer100g: 10, fatPer100g: 5.5, fiberPer100g: 4 },
  { id: 'local-falafel', name: 'Falafel', caloriesPer100g: 333, carbsPer100g: 32, proteinPer100g: 13, fatPer100g: 18, fiberPer100g: 10 },
  { id: 'local-huehnersuppe', name: 'Hühnersuppe', caloriesPer100g: 35, carbsPer100g: 3, proteinPer100g: 3, fatPer100g: 1.2 },
  { id: 'local-tomatensuppe', name: 'Tomatensuppe', caloriesPer100g: 45, carbsPer100g: 7, proteinPer100g: 1.2, fatPer100g: 1.5 },
  { id: 'local-gemuesesuppe', name: 'Gemüsesuppe', caloriesPer100g: 30, carbsPer100g: 4, proteinPer100g: 1.5, fatPer100g: 0.8 },
  { id: 'local-risotto', name: 'Risotto', caloriesPer100g: 166, carbsPer100g: 25, proteinPer100g: 3.5, fatPer100g: 5.5 },
  { id: 'local-paella', name: 'Paella', caloriesPer100g: 158, carbsPer100g: 20, proteinPer100g: 7, fatPer100g: 5 },

  // Hülsenfrüchte
  { id: 'local-rote-linsen', name: 'Rote Linsen, gekocht', caloriesPer100g: 100, carbsPer100g: 17, proteinPer100g: 8, fatPer100g: 0.4, fiberPer100g: 4 },
  { id: 'local-schwarze-bohnen', name: 'Schwarze Bohnen, gekocht', caloriesPer100g: 132, carbsPer100g: 24, proteinPer100g: 8.9, fatPer100g: 0.5, fiberPer100g: 8.7 },
  { id: 'local-kidneybohnen', name: 'Kidneybohnen, gekocht', caloriesPer100g: 127, carbsPer100g: 23, proteinPer100g: 8.7, fatPer100g: 0.5, fiberPer100g: 6.4 },
  { id: 'local-erbsen-getrocknet', name: 'Erbsen, getrocknet, gekocht', caloriesPer100g: 118, carbsPer100g: 21, proteinPer100g: 8, fatPer100g: 0.4, fiberPer100g: 5 },

  // Gewürze & Saucen
  { id: 'local-ketchup', name: 'Ketchup', caloriesPer100g: 100, carbsPer100g: 24, proteinPer100g: 1.2, fatPer100g: 0.2, sugarPer100g: 21, sodiumPer100gMg: 900 },
  { id: 'local-senf', name: 'Senf', caloriesPer100g: 66, carbsPer100g: 5, proteinPer100g: 4, fatPer100g: 3.5, sodiumPer100gMg: 1100 },
  { id: 'local-mayonnaise', name: 'Mayonnaise', caloriesPer100g: 680, carbsPer100g: 1, proteinPer100g: 1.1, fatPer100g: 75 },
  { id: 'local-sojasauce', name: 'Sojasauce', caloriesPer100g: 60, carbsPer100g: 6, proteinPer100g: 8, fatPer100g: 0, sodiumPer100gMg: 5500 },
  { id: 'local-balsamico', name: 'Balsamico-Essig', caloriesPer100g: 88, carbsPer100g: 17, proteinPer100g: 0.5, fatPer100g: 0 },
  { id: 'local-pesto', name: 'Pesto', caloriesPer100g: 450, carbsPer100g: 6, proteinPer100g: 4, fatPer100g: 45 },

  // Schweizer Spezialitäten - generic per-100g values (nutrition-table
  // estimates, same standard as the rest of this file, not from a single
  // brand) for everyday Swiss dishes that the DACH-focused list above
  // doesn't cover, so common Swiss home-cooking logs without a network hit.
  { id: 'local-roesti', name: 'Rösti', caloriesPer100g: 160, carbsPer100g: 22, proteinPer100g: 2.5, fatPer100g: 7, fiberPer100g: 2 },
  { id: 'local-fondue-kaese', name: 'Käsefondue', caloriesPer100g: 290, carbsPer100g: 3, proteinPer100g: 17, fatPer100g: 23, sodiumPer100gMg: 700 },
  { id: 'local-raclette-kaese', name: 'Raclettekäse', caloriesPer100g: 330, carbsPer100g: 0, proteinPer100g: 24, fatPer100g: 26, sodiumPer100gMg: 750 },
  { id: 'local-cervelat', name: 'Cervelat', caloriesPer100g: 260, carbsPer100g: 1, proteinPer100g: 14, fatPer100g: 22, sodiumPer100gMg: 950 },
  { id: 'local-bircher-muesli', name: 'Bircher Müesli', caloriesPer100g: 130, carbsPer100g: 20, proteinPer100g: 3, fatPer100g: 3.5, fiberPer100g: 2.5, sugarPer100g: 11 },
  { id: 'local-zopf', name: 'Zopf', caloriesPer100g: 300, carbsPer100g: 50, proteinPer100g: 9, fatPer100g: 7 },
  { id: 'local-aelplermagronen', name: 'Älplermagronen', caloriesPer100g: 175, carbsPer100g: 17, proteinPer100g: 6.5, fatPer100g: 9 },
  { id: 'local-zuercher-geschnetzeltes', name: 'Zürcher Geschnetzeltes', caloriesPer100g: 155, carbsPer100g: 3, proteinPer100g: 16, fatPer100g: 9 },
  { id: 'local-basler-laeckerli', name: 'Basler Läckerli', caloriesPer100g: 380, carbsPer100g: 72, proteinPer100g: 4, fatPer100g: 8, sugarPer100g: 45 },
  { id: 'local-ovomaltine', name: 'Ovomaltine, Pulver', caloriesPer100g: 375, carbsPer100g: 75, proteinPer100g: 8, fatPer100g: 4, sugarPer100g: 60 },
  { id: 'local-rivella-rot', name: 'Rivella Rot', caloriesPer100g: 22, carbsPer100g: 5.3, proteinPer100g: 0, fatPer100g: 0, sugarPer100g: 5.3 },
  { id: 'local-toblerone', name: 'Toblerone', caloriesPer100g: 534, carbsPer100g: 58, proteinPer100g: 5.5, fatPer100g: 31, sugarPer100g: 55 },
  { id: 'local-bratwurst-st-galler', name: 'St. Galler Bratwurst', caloriesPer100g: 280, carbsPer100g: 1.5, proteinPer100g: 14, fatPer100g: 24, sodiumPer100gMg: 850 },
  { id: 'local-gruyere', name: 'Gruyère', caloriesPer100g: 396, carbsPer100g: 0, proteinPer100g: 27, fatPer100g: 32, sodiumPer100gMg: 650 },
  { id: 'local-emmentaler', name: 'Emmentaler', caloriesPer100g: 380, carbsPer100g: 0, proteinPer100g: 28, fatPer100g: 30, sodiumPer100gMg: 400 },
  { id: 'local-appenzeller-kaese', name: 'Appenzeller Käse', caloriesPer100g: 390, carbsPer100g: 0, proteinPer100g: 25, fatPer100g: 32, sodiumPer100gMg: 600 },
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
    fructose: estimateFructoseFromSugar(seed.name, seed.sugarPer100g),
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
