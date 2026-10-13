// Cross-language food vocabulary: the food database is German, but a food can be
// searched (or named by the AI photo analysis) in English, French, Italian or
// Swiss German. Every alias below maps onto the German term the database uses,
// so "chicken breast", "blanc de poulet" and "petto di pollo" all resolve to
// "Hähnchenbrust" - offline, with no translation round-trip, and to the exact
// entry with its macros rather than whatever a foreign-language search returns.
//
// Deliberately a curated list of everyday foods, not a general dictionary:
// anything not listed here still reaches the remote tiers untranslated (Open
// Food Facts is multilingual on its own) and, failing that, the machine-
// translation fallback in services/foodSearch.ts.

/** Lowercase, strips accents/diacritics, and collapses non-alphanumeric runs to single spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    // These have no combining-mark decomposition, so NFD alone would leave them
    // to be stripped as punctuation ("bœuf" -> "b uf", "Weißbrot" -> "wei brot").
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// [German term as the database spells it, aliases in other languages]. Aliases
// match whole words/phrases only (never inside a longer word - "riso" must not
// fire inside "risotto"), longest phrase first, after normalizeSearchText - so
// accents, apostrophes and case don't need to be spelled out as variants.
//
// Left out on purpose where a word means something else in German or another
// listed language: French "pommes" (German for fries), "thé"/"te" (normalize to
// English "the"), French "raisins" (grapes, but English raisins), "crème".
const FOOD_ALIAS_GROUPS: [german: string, aliases: string[]][] = [
  // Fleisch & Geflügel
  ['Hähnchenbrust', ['chicken breast', 'chicken breasts', 'blanc de poulet', 'filet de poulet', 'poitrine de poulet', 'petto di pollo', 'petti di pollo']],
  ['Hähnchenschenkel', ['chicken thigh', 'chicken thighs', 'chicken leg', 'chicken legs', 'cuisse de poulet', 'cuisses de poulet', 'coscia di pollo', 'cosce di pollo']],
  ['Hähnchen', ['chicken', 'pollo']],
  ['Putenbrust', ['turkey breast', 'blanc de dinde', 'filet de dinde', 'escalope de dinde', 'petto di tacchino', 'fesa di tacchino']],
  ['Pute', ['turkey', 'dinde', 'tacchino']],
  [
    'Rindshackfleisch',
    ['ground beef', 'minced beef', 'beef mince', 'boeuf haché', 'viande hachée de boeuf', 'steak haché', 'carne macinata di manzo', 'macinato di manzo', 'manzo macinato'],
  ],
  ['Hackfleisch', ['minced meat', 'ground meat', 'mince', 'viande hachée', 'haché', 'hachée', 'carne macinata', 'macinato', 'macinata', 'carne trita', 'tritato']],
  ['Rindfleisch', ['beef', 'boeuf', 'viande de boeuf', 'manzo', 'carne di manzo']],
  ['Schweinsfilet', ['pork tenderloin', 'pork fillet', 'filet de porc', 'filet mignon de porc', 'filetto di maiale']],
  ['Schweinefleisch', ['pork', 'porc', 'viande de porc', 'maiale', 'carne di maiale']],
  ['Kalbfleisch', ['veal', 'veau', 'vitello']],
  ['Lammfleisch', ['lamb', 'agneau', 'agnello']],
  ['Schinken, gekocht', ['cooked ham', 'jambon cuit', 'prosciutto cotto']],
  ['Schinken', ['ham', 'jambon']],
  ['Speck', ['bacon', 'lardons', 'pancetta']],
  ['Wurst', ['sausage', 'sausages', 'saucisse', 'saucisses', 'salsiccia', 'salsicce']],
  ['Brust', ['breast', 'poitrine', 'petto']],
  ['Schenkel', ['thigh', 'thighs', 'cuisse', 'cuisses', 'coscia', 'cosce']],
  ['Filet', ['fillet', 'filetto']],
  ['Fleisch', ['meat', 'viande', 'carne']],

  // Zubereitung
  ['roh', ['raw', 'uncooked', 'cru', 'crue', 'crudo', 'cruda']],
  ['gekocht', ['cooked', 'boiled', 'cuit', 'cuite', 'cuits', 'cuites', 'cotto', 'cotta', 'bollito']],
  ['gebraten', ['fried', 'pan fried', 'roasted', 'grilled', 'frit', 'frite', 'rôti', 'grillé', 'grillée', 'poêlé', 'fritto', 'arrosto', 'alla griglia', 'grigliato', 'in padella']],

  // Fisch
  ['Lachs', ['salmon', 'saumon', 'salmone']],
  ['Thunfisch', ['tuna', 'thon', 'tonno']],
  ['Kabeljau', ['cod', 'cabillaud', 'merluzzo']],
  ['Forelle', ['trout', 'truite', 'trota']],
  ['Makrele', ['mackerel', 'maquereau', 'sgombro']],
  ['Garnelen', ['shrimp', 'shrimps', 'prawns', 'crevettes', 'gamberi', 'gamberetti']],

  // Milchprodukte & Eier
  ['Vollmilch', ['whole milk', 'lait entier', 'latte intero']],
  ['Fettarme Milch', ['skim milk', 'skimmed milk', 'semi skimmed milk', 'low fat milk', 'lait demi-écrémé', 'lait écrémé', 'latte parzialmente scremato', 'latte scremato']],
  ['Milch', ['milk', 'lait', 'latte']],
  ['Griechischer Joghurt', ['greek yogurt', 'greek yoghurt', 'yaourt grec', 'yogourt grec', 'yogurt greco']],
  ['Joghurt', ['yogurt', 'yoghurt', 'yaourt', 'yogourt']],
  ['Magerquark', ['low fat quark', 'low fat curd', 'séré maigre', 'fromage blanc maigre', 'quark magro']],
  ['Quark', ['curd', 'séré', 'fromage blanc']],
  ['Hüttenkäse', ['cottage cheese']],
  ['Frischkäse', ['cream cheese', 'fromage frais', 'fromage à tartiner', 'formaggio fresco', 'formaggio spalmabile']],
  ['Käse', ['cheese', 'fromage', 'formaggio']],
  ['Butter', ['beurre', 'burro']],
  ['Sahne', ['cream', 'panna']],
  ['Eiweiß', ['egg white', 'egg whites', "blanc d'oeuf", "blancs d'oeufs", 'albume']],
  ['Ei', ['egg', 'eggs', 'oeuf', 'oeufs', 'uovo', 'uova']],

  // Getreide, Brot, Beilagen
  ['Vollkornreis', ['brown rice', 'riz complet', 'riso integrale']],
  ['Reiswaffeln', ['rice cakes', 'rice cake', 'galettes de riz', 'gallette di riso']],
  ['Reis', ['rice', 'riz', 'riso']],
  ['Vollkornnudeln', ['whole wheat pasta', 'wholemeal pasta', 'whole grain pasta', 'pâtes complètes', 'pasta integrale']],
  ['Nudeln', ['pasta', 'noodles', 'pâtes', 'nouilles']],
  ['Vollkornbrot', ['whole grain bread', 'wholemeal bread', 'whole wheat bread', 'pain complet', 'pane integrale']],
  ['Weißbrot', ['white bread', 'pain blanc', 'pane bianco']],
  ['Brot', ['bread', 'pain', 'pane']],
  ['Süßkartoffel', ['sweet potato', 'sweet potatoes', 'patate douce', 'patates douces', 'patata dolce', 'patate dolci']],
  ['Pommes frites', ['french fries', 'fries', 'patatine fritte']],
  ['Kartoffeln', ['potato', 'potatoes', 'pomme de terre', 'pommes de terre', 'patata', 'patate']],
  ['Haferflocken', ['oats', 'oatmeal', 'rolled oats', 'porridge oats', "flocons d'avoine", 'avoine', "fiocchi d'avena", 'avena']],
  ['Müsli', ['muesli', 'granola']],

  // Gemüse & Hülsenfrüchte
  ['Tomate', ['tomato', 'tomatoes', 'tomates', 'pomodoro', 'pomodori']],
  ['Gurke', ['cucumber', 'concombre', 'cetriolo']],
  ['Karotte', ['carrot', 'carrots', 'carotte', 'carottes', 'carota', 'carote']],
  ['Zwiebel', ['onion', 'onions', 'oignon', 'oignons', 'cipolla', 'cipolle']],
  ['Spinat', ['spinach', 'épinards', 'spinaci']],
  ['Brokkoli', ['broccoli', 'brocoli']],
  ['Blumenkohl', ['cauliflower', 'chou-fleur', 'cavolfiore']],
  ['Paprika', ['bell pepper', 'bell peppers', 'poivron', 'poivrons', 'peperone']],
  ['Aubergine', ['eggplant', 'melanzana', 'melanzane']],
  ['Zucchini', ['courgette', 'courgettes', 'zucchine']],
  ['Champignons', ['mushroom', 'mushrooms', 'funghi']],
  ['Erbsen', ['peas', 'petits pois', 'piselli']],
  ['Mais', ['corn', 'sweetcorn', 'sweet corn', 'granturco']],
  ['Salat', ['salad', 'lettuce', 'salade', 'laitue', 'insalata', 'lattuga']],
  ['Kichererbsen', ['chickpeas', 'chick peas', 'pois chiches', 'ceci']],
  ['Kidneybohnen', ['kidney beans', 'haricots rouges', 'fagioli rossi']],
  ['Schwarze Bohnen', ['black beans', 'haricots noirs', 'fagioli neri']],
  ['Weiße Bohnen', ['white beans', 'haricots blancs', 'fagioli bianchi']],
  ['Bohnen', ['beans', 'haricots', 'fagioli']],
  ['Rote Linsen', ['red lentils', 'lentilles corail', 'lenticchie rosse']],
  ['Linsen', ['lentils', 'lentilles', 'lenticchie']],

  // Obst
  ['Apfel', ['apple', 'apples', 'pomme', 'mela', 'mele']],
  ['Birne', ['pear', 'pears', 'poire', 'poires', 'pera', 'pere']],
  ['Banane', ['banana', 'bananas']],
  ['Erdbeeren', ['strawberry', 'strawberries', 'fraise', 'fraises', 'fragola', 'fragole']],
  ['Blaubeeren', ['blueberry', 'blueberries', 'myrtilles', 'mirtilli']],
  ['Himbeeren', ['raspberry', 'raspberries', 'framboises', 'lamponi']],
  ['Weintrauben', ['grapes', 'uva']],
  ['Zitrone', ['lemon', 'citron', 'limone']],
  ['Pfirsich', ['peach', 'peaches', 'pêche', 'pesca']],
  ['Wassermelone', ['watermelon', 'pastèque', 'anguria']],
  ['Kirschen', ['cherry', 'cherries', 'cerises', 'ciliegie']],
  ['Datteln', ['dates', 'dattes', 'datteri']],

  // Nüsse, Fette, Süßes
  ['Erdnussbutter', ['peanut butter', 'beurre de cacahuète', 'beurre de cacahuètes', 'burro di arachidi']],
  ['Erdnuss', ['peanut', 'peanuts', 'cacahuète', 'cacahuètes', 'arachidi']],
  ['Mandeln', ['almond', 'almonds', 'amandes', 'mandorle']],
  ['Cashewkerne', ['cashew', 'cashews', 'cashew nuts', 'noix de cajou', 'anacardi']],
  ['Haselnüsse', ['hazelnut', 'hazelnuts', 'noisettes', 'nocciole']],
  ['Walnüsse', ['walnut', 'walnuts', 'noix', 'noci']],
  ['Olivenöl', ['olive oil', "huile d'olive", "olio d'oliva", 'olio di oliva']],
  ['Öl', ['oil', 'huile', 'olio']],
  ['Zucker', ['sugar', 'sucre', 'zucchero']],
  ['Honig', ['honey', 'miel', 'miele']],
  ['Schokolade', ['chocolate', 'chocolat', 'cioccolato']],
  ['Eis', ['ice cream', 'glace', 'gelato']],
  ['Kokos', ['coconut', 'noix de coco', 'cocco']],
  ['Proteinpulver', ['protein powder', 'whey protein', 'protéine en poudre', 'protéines en poudre', 'proteine in polvere']],

  // Getränke
  ['Orangensaft', ['orange juice', "jus d'orange", "succo d'arancia"]],
  ['Apfelsaft', ['apple juice', 'jus de pomme', 'succo di mela']],
  ['Saft', ['juice', 'jus', 'succo']],
  ['Wasser', ['water', 'eau', 'acqua']],
  ['Kaffee', ['coffee', 'café', 'caffè']],
  ['Tee', ['tea']],
  ['Bier', ['beer', 'bière', 'birra']],
  ['Wein', ['wine', 'vin', 'vino']],
];

// Swiss-German terms that mostly occur inside compounds ("Pouletbrust",
// "Trutenbrust", "Rindsgehacktes"), so unlike the list above they're replaced
// as substrings of a word. Kept to terms that don't occur inside unrelated words.
const COMPOUND_ALIASES: [alias: string, german: string][] = [
  ['poulet', 'Hähnchen'],
  ['trute', 'Pute'],
  ['gehacktes', 'Hackfleisch'],
];

interface AliasTarget {
  /** As the database spells it - what a translated remote query should contain. */
  display: string;
  /** normalizeSearchText(display) - what name comparisons work on. */
  normalized: string;
}

const ALIAS_TARGETS = new Map<string, AliasTarget>();
let maxAliasWords = 1;
for (const [german, aliases] of FOOD_ALIAS_GROUPS) {
  const target: AliasTarget = { display: german, normalized: normalizeSearchText(german) };
  for (const alias of aliases) {
    const key = normalizeSearchText(alias);
    // First listed wins - groups are ordered so the specific one comes first.
    if (!ALIAS_TARGETS.has(key)) ALIAS_TARGETS.set(key, target);
    maxAliasWords = Math.max(maxAliasWords, key.split(' ').length);
  }
}

const COMPOUND_TARGETS = COMPOUND_ALIASES.map(([alias, german]) => ({ alias, target: { display: german.toLowerCase(), normalized: normalizeSearchText(german) } }));

/** Single-word aliases long enough to typo-correct against (see data/foodDatabase.ts) - short ones are too close to unrelated words. */
export const FOOD_ALIAS_WORDS: string[] = [...ALIAS_TARGETS.keys()].filter((key) => !key.includes(' ') && key.length >= 5);

/** Connectors that carry no meaning once a phrase has been translated word by word ("petto de poulet" -> "brust de hahnchen"). */
export const SEARCH_STOPWORDS = new Set(['de', 'di', 'du', 'des', 'da', 'd', 'of', 'the', 'la', 'le', 'il', 'al', 'alla']);

function rewriteWords(words: string[], form: keyof AliasTarget): { words: string[]; changed: boolean } {
  const result: string[] = [];
  let changed = false;

  let index = 0;
  while (index < words.length) {
    let target: AliasTarget | undefined;
    let consumed = 1;
    for (let length = Math.min(maxAliasWords, words.length - index); length >= 1 && !target; length--) {
      target = ALIAS_TARGETS.get(words.slice(index, index + length).join(' '));
      if (target) consumed = length;
    }

    if (target) {
      result.push(target[form]);
      changed = true;
    } else {
      let word = words[index];
      for (const compound of COMPOUND_TARGETS) {
        if (!word.includes(compound.alias)) continue;
        word = word.split(compound.alias).join(compound.target[form]);
        changed = true;
      }
      result.push(word);
    }
    index += consumed;
  }

  return { words: result, changed };
}

/**
 * Rewrites every known foreign-language/regional food term in an
 * already-normalized string to the database's German spelling ("chicken breast
 * raw" -> "hahnchenbrust roh"). Applied to BOTH sides of a name comparison, so
 * it doesn't matter which language either side is in.
 */
export function canonicalizeFoodTerms(normalizedText: string): string {
  if (!normalizedText) return normalizedText;
  return rewriteWords(normalizedText.split(' '), 'normalized').words.join(' ');
}

/**
 * The German search query for a foreign-language one ("blanc de poulet" ->
 * "Hähnchenbrust"), properly spelled so it can be sent to the remote search
 * tiers as-is. null when the query contains no known foreign term - it's
 * either German already or outside this vocabulary.
 */
export function translateFoodQueryToGerman(query: string): string | null {
  const normalized = normalizeSearchText(query);
  if (!normalized) return null;

  const { words, changed } = rewriteWords(normalized.split(' '), 'display');
  if (!changed) return null;

  const meaningful = words.filter((word) => !SEARCH_STOPWORDS.has(word));
  return (meaningful.length > 0 ? meaningful : words).join(' ');
}
