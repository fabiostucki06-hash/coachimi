export interface PortionUnit {
  id: string;
  label: string;
  grams: number;
}

interface PortionCategory {
  /** Normalized (umlaut-folded, lowercase) whole-word tokens that identify this category. */
  keywords: string[];
  units: PortionUnit[];
  /** Which of `units` is preselected (e.g. in log-quantity) before the user picks one explicitly. */
  defaultUnitId: string;
}

/** Fallback for anything that doesn't match a more specific category below (rice, pasta, meat, ...). */
const STAPLE_UNITS: PortionUnit[] = [
  { id: 'portion_small', label: '1 kleine Portion', grams: 150 },
  { id: 'portion_medium', label: '1 normale Portion', grams: 250 },
  { id: 'portion_large', label: '1 große Portion', grams: 350 },
];
const STAPLE_DEFAULT_UNIT_ID = 'portion_medium';

/** Checked in order - the first category with a matching keyword wins. */
const PORTION_CATEGORIES: PortionCategory[] = [
  {
    keywords: ['apfel', 'aepfel', 'birne', 'birnen'],
    units: [
      { id: 'apple_small', label: '1 kleiner Apfel', grams: 120 },
      { id: 'apple_medium', label: '1 mittlerer Apfel', grams: 160 },
      { id: 'apple_large', label: '1 großer Apfel', grams: 200 },
    ],
    defaultUnitId: 'apple_medium',
  },
  {
    keywords: ['banane', 'bananen'],
    units: [
      { id: 'banana_small', label: '1 kleine Banane', grams: 100 },
      { id: 'banana_medium', label: '1 mittlere Banane', grams: 120 },
      { id: 'banana_large', label: '1 große Banane', grams: 150 },
    ],
    defaultUnitId: 'banana_medium',
  },
  {
    keywords: ['brot', 'brote', 'broetchen', 'toast', 'baguette'],
    units: [
      { id: 'slice_thin', label: '1 dünne Scheibe', grams: 30 },
      { id: 'slice_medium', label: '1 normale Scheibe', grams: 50 },
      { id: 'slice_thick', label: '1 dicke Scheibe', grams: 70 },
    ],
    defaultUnitId: 'slice_medium',
  },
  {
    keywords: ['riegel'],
    units: [
      { id: 'bar_half', label: '1 halber Riegel', grams: 22.5 },
      { id: 'bar_whole', label: '1 Riegel', grams: 45 },
    ],
    defaultUnitId: 'bar_whole',
  },
  {
    keywords: ['ei', 'eier'],
    units: [
      { id: 'egg_m', label: '1 Ei (Größe M)', grams: 55 },
      { id: 'egg_l', label: '1 Ei (Größe L)', grams: 65 },
    ],
    defaultUnitId: 'egg_m',
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// German food names are frequently compounded without spaces ("Vollkornbrot",
// "Proteinriegel"), so keywords need substring matching against each token to
// find them. But short keywords like "ei" (egg) can't use plain substring
// matching - "Reis" and "Fleisch" both contain "ei" mid-word despite having
// nothing to do with eggs. Restricting short keywords to a token-final match
// (whole token or suffix, e.g. "Spiegelei") keeps those out while still
// catching compounds that end in the keyword.
function tokenMatchesKeyword(token: string, keyword: string): boolean {
  return keyword.length <= 3 ? token === keyword || token.endsWith(keyword) : token.includes(keyword);
}

function matchCategory(foodName: string): PortionCategory | undefined {
  const tokens = tokenize(foodName);
  return PORTION_CATEGORIES.find((candidate) =>
    candidate.keywords.some((keyword) => tokens.some((token) => tokenMatchesKeyword(token, keyword))),
  );
}

/** Matches a searched/selected food name against the portion dictionary, falling back to generic portion-size presets for anything unrecognized. */
export function getPortionUnitsForFood(foodName: string): PortionUnit[] {
  return matchCategory(foodName)?.units ?? STAPLE_UNITS;
}

/**
 * The portion chip to preselect for a food before the user taps one explicitly (e.g. a
 * scanned bar defaults to "1 Riegel" instead of a blanket 100g) - one specific default
 * per category rather than always picking the middle-sized option, since "typical size"
 * isn't the same array position for every category (e.g. bars default to whole, not half).
 */
export function getDefaultPortionUnit(foodName: string): PortionUnit {
  const category = matchCategory(foodName);
  if (category) return category.units.find((unit) => unit.id === category.defaultUnitId) ?? category.units[0];
  return STAPLE_UNITS.find((unit) => unit.id === STAPLE_DEFAULT_UNIT_ID) ?? STAPLE_UNITS[0];
}
