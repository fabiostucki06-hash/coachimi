import type { Macros } from '@/types';

export type TimeOfDay = 'morning' | 'midday' | 'evening';
export type TipMode = 'food' | 'timing' | 'hydration';

export interface Recommendation {
  mode: TipMode;
  modeLabel: string;
  timeLabel: string;
  headline: string;
  suggestion: string;
  /** Size of the combined tip pool this recommendation was drawn from - lets the UI cycle through every matching tip (across all modes) without repeats. */
  variantCount: number;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morgens',
  midday: 'Mittags',
  evening: 'Abends',
};

const MODE_LABELS: Record<TipMode, string> = {
  food: 'Snack-Idee',
  timing: 'Tactical Tipp',
  hydration: 'Hydration',
};

/** A food/snack tip plus the grammatical number of its head noun, so the "passt"/"passen" template agrees ("Reiswaffeln mit Honig passen" vs. "Magerquark mit Beeren passt"). */
interface FoodTip {
  text: string;
  plural: boolean;
}

interface TimingTip {
  headline: string;
  suggestion: string;
  times: TimeOfDay[];
}

interface HydrationTip {
  headline: string;
  suggestion: string;
}

/** Tip pool grouped by which macro (or situation) it best fits. First entries per group stay stable so callers without a variantIndex, and existing snapshots/tests, get a deterministic pick. */
const TIPS_BY_MACRO: Record<'protein' | 'carbs' | 'fat' | 'balanced', FoodTip[]> = {
  carbs: [
    { text: 'Vollkornpasta mit Gemüsesoße', plural: false },
    { text: 'Haferflocken mit Banane & Beeren', plural: true },
    { text: 'Kartoffelecken aus dem Ofen', plural: true },
    { text: 'Reiswaffeln mit Honig', plural: true },
    { text: 'Couscous-Salat', plural: false },
    { text: 'Quinoa-Bowl', plural: false },
    { text: 'Süßkartoffel-Pommes aus dem Ofen', plural: true },
    { text: 'Vollkornbrot mit Honig', plural: false },
    { text: 'Bananenbrot-Scheibe', plural: false },
    { text: 'Müsli mit Milch', plural: false },
    { text: 'Reisnudeln mit Gemüse', plural: true },
    { text: 'Bulgur-Salat', plural: false },
    { text: 'Vollkornbrötchen mit Marmelade', plural: false },
    { text: 'Getrocknete Datteln', plural: true },
    { text: 'Vollkorn-Toast mit Marmelade', plural: false },
    { text: 'Milchreis mit Zimt', plural: false },
    { text: 'Haferflocken-Porridge mit Apfel', plural: false },
    { text: 'Naan-Brot mit Honig', plural: false },
    { text: 'Rote-Bete-Salat mit Couscous', plural: false },
    { text: 'Gebackene Kartoffel mit Kräuterquark', plural: false },
    { text: 'Vollkorn-Bagel', plural: false },
    { text: 'Obstsalat mit Haferflocken', plural: false },
  ],
  protein: [
    { text: 'Magerquark mit Beeren', plural: false },
    { text: 'Hähnchenbrustfilet', plural: false },
    { text: 'Thunfisch im eigenen Saft', plural: false },
    { text: 'Proteinpulver-Shake', plural: false },
    { text: 'Hüttenkäse', plural: false },
    { text: 'Griechischer Joghurt 0%', plural: false },
    { text: 'Eiklar-Omelett', plural: false },
    { text: 'Proteinriegel', plural: false },
    { text: 'Linsen-Salat', plural: false },
    { text: 'Kichererbsen-Bowl', plural: false },
    { text: 'Räuchertofu-Würfel', plural: true },
    { text: 'Skyr Natur', plural: false },
    { text: 'Putenbrust-Aufschnitt', plural: false },
    { text: 'Gekochte Eier', plural: true },
    { text: 'Edamame', plural: true },
    { text: 'Proteinchia-Pudding', plural: false },
    { text: 'Rinderfilet-Streifen', plural: true },
    { text: 'Lachsfilet', plural: false },
    { text: 'Garnelen-Spieß', plural: false },
    { text: 'Sojajoghurt mit Nüssen', plural: false },
    { text: 'Proteinbrot mit Frischkäse', plural: false },
    { text: 'Hähnchen-Snack-Spieße', plural: true },
  ],
  fat: [
    { text: 'Handvoll Mandeln/Walnüsse', plural: true },
    { text: 'Avocado auf Vollkornbrot', plural: false },
    { text: 'Erdnussmus auf Apfelscheiben', plural: false },
    { text: 'Dunkle Schokolade (85%+)', plural: false },
    { text: 'Olivenöl-Dressing', plural: false },
    { text: 'Chiasamen-Pudding mit Kokosmilch', plural: false },
    { text: 'Handvoll Cashewkerne', plural: true },
    { text: 'Nussbutter auf Reiswaffel', plural: false },
    { text: 'Oliven mit Feta', plural: true },
    { text: 'Leinöl über den Salat', plural: false },
  ],
  balanced: [
    { text: 'Lachsfilet mit Brokkoli und Süßkartoffel', plural: false },
    { text: 'Vollkorn-Wrap mit Pute & Avocado', plural: false },
    { text: 'Gemischter Salat mit Feta und Hähnchen', plural: false },
    { text: 'Bowl mit Quinoa, Kichererbsen und Gemüse', plural: false },
    { text: 'Gebratener Tofu mit Gemüse und Reis', plural: false },
    { text: 'Linsen-Curry mit Naturjoghurt', plural: false },
    { text: 'Omelett mit Vollkornbrot und Avocado', plural: false },
    { text: 'Putengeschnetzeltes mit Gemüse und Vollkornreis', plural: false },
    { text: 'Gefüllte Süßkartoffel mit Hähnchen und Salat', plural: false },
    { text: 'Vollkorn-Sandwich mit Ei und Gemüse', plural: false },
  ],
};

/** Light snacks for when very little calorie budget is left - takes priority over the macro-gap pools regardless of which macro is technically most open. */
const LOW_CALORIE_SNACKS: FoodTip[] = [
  { text: 'Gurkenscheiben mit Kräuterquark', plural: true },
  { text: 'Beerenmix', plural: false },
  { text: 'Selleriestangen mit Hummus', plural: true },
  { text: 'Cherrytomaten mit Balsamico', plural: true },
  { text: 'Gemüsesticks mit Joghurt-Dip', plural: true },
  { text: 'Klare Gemüsebrühe', plural: false },
  { text: 'Wassermelonen-Würfel', plural: true },
  { text: 'Radieschen mit Salz', plural: true },
  { text: 'Reiswaffel mit Frischkäse', plural: false },
  { text: 'Apfelscheiben ohne alles', plural: true },
  { text: 'Magerquark mit Zimt (kleine Portion)', plural: false },
  { text: 'Gemischter Blattsalat ohne Dressing', plural: false },
  { text: 'Zucchini-Sticks aus dem Ofen', plural: true },
  { text: 'Grapefruit-Hälfte', plural: false },
  { text: 'Karottensticks mit Kräuterquark', plural: true },
  { text: 'Eiweiß-Eierspeise (2 Eiklar)', plural: false },
  { text: 'Beeren-Snack aus dem Tiefkühlfach', plural: false },
  { text: 'Gurken-Joghurt-Salat (Cacik)', plural: false },
  { text: 'Paprikastreifen mit Frischkäse', plural: true },
  { text: 'Klare Miso-Suppe', plural: false },
];

/** Tactical/timing habits (fueling, recovery, sleep) - each tagged with the times of day it's relevant for. */
const TACTICAL_TIPS: TimingTip[] = [
  { headline: 'Pre-Workout Fuel', suggestion: 'Ca. 60-90 Minuten vor dem Training eine kohlenhydratreiche Kleinigkeit essen, z. B. eine Banane, für stabile Energie.', times: ['morning', 'midday'] },
  { headline: 'Post-Workout-Fenster', suggestion: 'Innerhalb von 30-60 Minuten nach dem Training Protein und Kohlenhydrate kombinieren, um die Regeneration zu unterstützen.', times: ['morning', 'midday', 'evening'] },
  { headline: 'Schlaf-Optimierung', suggestion: 'Reduziere Bildschirmzeit 30 Minuten vor dem Schlafen – das verbessert die Schlafqualität und damit die Regeneration.', times: ['evening'] },
  { headline: 'Koffein-Cutoff', suggestion: 'Nach 15 Uhr auf Kaffee verzichten, damit das Koffein deinen Schlaf nicht beeinträchtigt.', times: ['midday', 'evening'] },
  { headline: 'Magnesium vor dem Schlafen', suggestion: 'Magnesiumreiche Lebensmittel wie Nüsse oder Kürbiskerne am Abend unterstützen die Muskelentspannung über Nacht.', times: ['evening'] },
  { headline: 'Mobility-Routine', suggestion: '5 Minuten dynamisches Dehnen vor dem Training verbessert die Beweglichkeit und senkt das Verletzungsrisiko.', times: ['morning', 'midday'] },
  { headline: 'Spaziergang nach dem Essen', suggestion: 'Ein 10-minütiger Spaziergang nach der Mahlzeit hilft dem Blutzuckerspiegel, stabil zu bleiben.', times: ['morning', 'midday', 'evening'] },
  { headline: 'Schlafenszeit-Routine', suggestion: 'Versuch jeden Abend zur gleichen Zeit ins Bett zu gehen – ein fester Rhythmus verbessert die Erholung.', times: ['evening'] },
  { headline: 'Fokus-Boost', suggestion: 'Eine kurze 5-Minuten-Atemübung kann die Konzentration in der Mittagsmüdigkeit wieder anheben.', times: ['midday'] },
  { headline: 'Aktive Pause', suggestion: 'Steh alle 60-90 Minuten kurz auf und beweg dich – das hält Energielevel und Stoffwechsel aktiv.', times: ['morning', 'midday'] },
  { headline: 'Dehnen vor dem Schlafen', suggestion: 'Sanftes Dehnen der Beine und des unteren Rückens vor dem Schlafen kann Muskelverspannungen lösen.', times: ['evening'] },
  { headline: 'Tageslicht-Boost', suggestion: '10 Minuten Tageslicht direkt nach dem Aufwachen helfen, den Schlaf-Wach-Rhythmus zu stabilisieren.', times: ['morning'] },
  { headline: 'Meal-Timing', suggestion: 'Versuch deine größte Mahlzeit nicht später als 3 Stunden vor dem Schlafengehen zu essen.', times: ['evening'] },
  { headline: 'Warm-Up nicht vergessen', suggestion: '5-10 Minuten leichtes Aufwärmen vor dem Training senkt das Verletzungsrisiko deutlich.', times: ['morning', 'midday'] },
  { headline: 'Box-Breathing', suggestion: '4 Sekunden einatmen, 4 halten, 4 ausatmen, 4 halten – wiederhole das 5x für mehr Ruhe vor dem Schlafen.', times: ['evening'] },
  { headline: 'Snack-Timing', suggestion: 'Ein kleiner Snack alle 3-4 Stunden hält den Blutzucker stabil und verhindert Heißhunger am Abend.', times: ['morning', 'midday'] },
  { headline: 'Cool-Down-Routine', suggestion: '5 Minuten leichtes Auslaufen oder Dehnen nach dem Training unterstützt die aktive Erholung.', times: ['midday', 'evening'] },
  { headline: 'Blaulicht reduzieren', suggestion: 'Aktiviere den Nachtmodus deines Handys ab dem späten Abend, um die Melatoninproduktion nicht zu stören.', times: ['evening'] },
  { headline: 'Powernap-Fenster', suggestion: 'Ein 15-20 minütiger Powernap am frühen Nachmittag kann die Energie ohne Schlafstörungen am Abend zurückbringen.', times: ['midday'] },
  { headline: 'Wochenrückblick', suggestion: 'Nimm dir am Abend 2 Minuten Zeit, um zu reflektieren, was heute bei Ernährung und Training gut lief.', times: ['evening'] },
];

/** Hydration / micro-habit nudges - always available, independent of macros or time of day. */
const HYDRATION_TIPS: HydrationTip[] = [
  { headline: 'Wasser-Push', suggestion: 'Trink jetzt ein großes Glas Wasser – dein Körper verwechselt Durst oft mit Hunger.' },
  { headline: 'Elektrolyte auffüllen', suggestion: 'Eine Prise Salz und etwas Zitrone ins Wasser geben, um Elektrolyte nach dem Schwitzen aufzufüllen.' },
  { headline: 'Kräutertee statt Kaffee', suggestion: 'Gönn dir eine Tasse ungesüßten Kräutertee für zusätzliche Flüssigkeit ohne Kalorien.' },
  { headline: 'Wasserflasche sichtbar platzieren', suggestion: 'Stell dir eine Wasserflasche gut sichtbar auf den Schreibtisch – das erhöht automatisch deine Trinkmenge.' },
  { headline: 'Sprudelwasser-Kick', suggestion: 'Ein Glas Sprudelwasser mit Minze und Limette wirkt erfrischend und liefert keine Kalorien.' },
  { headline: 'Trink-Erinnerung', suggestion: 'Stell dir einen stündlichen Alarm, um regelmäßig kleine Schlucke Wasser zu trinken.' },
  { headline: 'Vor dem Essen trinken', suggestion: 'Trink ein Glas Wasser 15 Minuten vor der nächsten Mahlzeit – das unterstützt die Verdauung.' },
  { headline: 'Infused Water', suggestion: 'Gurken- und Zitronenscheiben ins Wasser geben, für mehr Geschmack ohne Zucker.' },
  { headline: 'Nach dem Aufwachen trinken', suggestion: 'Ein Glas Wasser direkt nach dem Aufstehen bringt deinen Kreislauf in Schwung.' },
  { headline: 'Koffein-Balance', suggestion: 'Trink zu jedem Kaffee ein zusätzliches Glas Wasser, um den harntreibenden Effekt auszugleichen.' },
  { headline: 'Ungesüßter Eistee', suggestion: 'Ein selbstgemachter, ungesüßter Eistee liefert Flüssigkeit und einen frischen Geschmack.' },
  { headline: 'Wasser-Etappen', suggestion: 'Versuch bis zum Abend zwei weitere Gläser Wasser zu trinken – in kleinen Etappen statt auf einmal.' },
  { headline: 'Suppe als Flüssigkeitsquelle', suggestion: 'Eine klare Gemüse- oder Hühnerbrühe zählt zur Flüssigkeitsbilanz und wärmt zusätzlich.' },
  { headline: 'Wasser mit Ingwer', suggestion: 'Frischer Ingwer im Wasser unterstützt die Verdauung und schmeckt angenehm scharf.' },
  { headline: 'Trinken beim Sport', suggestion: 'Alle 15-20 Minuten während des Trainings kleine Schlucke Wasser trinken statt große Mengen auf einmal.' },
  { headline: 'Kokoswasser-Boost', suggestion: 'Kokoswasser liefert natürliche Elektrolyte und ist eine leckere Alternative zu Sportgetränken.' },
  { headline: 'Wasser vor dem Schlafen', suggestion: 'Ein kleines Glas Wasser vor dem Schlafen reicht aus, ohne den Schlaf durch nächtliches Aufwachen zu stören.' },
  { headline: 'Trink-Routine am Arbeitsplatz', suggestion: 'Verbinde jede Kaffeepause mit einem Glas Wasser, um automatisch mehr zu trinken.' },
  { headline: 'Zitronenwasser am Morgen', suggestion: 'Warmes Wasser mit Zitrone am Morgen kann die Verdauung sanft ankurbeln.' },
  { headline: 'Wasser statt Softdrink', suggestion: 'Ersetz das nächste Softgetränk durch Wasser oder ungesüßten Tee, um Kalorien zu sparen.' },
];

const MACRO_LABELS: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'Protein',
  carbs: 'Kohlenhydrate',
  fat: 'Fett',
};

/** If the two largest macro gaps sit within this many grams of each other, no single macro dominates - suggest a balanced meal instead. */
const BALANCE_THRESHOLD_G = 15;

/** Below this many kcal remaining, prefer a light snack over whichever macro is technically most open. */
const LOW_CALORIE_THRESHOLD_KCAL = 150;

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'midday';
  return 'evening';
}

const DEFAULT_VISIBLE_MACROS: Record<'protein' | 'carbs' | 'fat', boolean> = {
  protein: true,
  carbs: true,
  fat: true,
};

function pickVariant<T>(pool: T[], variantIndex: number): T {
  return pool[((variantIndex % pool.length) + pool.length) % pool.length];
}

/** German subject-verb agreement for the "passt/passen" tip templates. */
function passt(plural: boolean): string {
  return plural ? 'passen' : 'passt';
}

export function generateRecommendation(
  timeOfDay: TimeOfDay,
  remainingCalories: number,
  remainingMacros: Macros,
  visibleMacros: Record<'protein' | 'carbs' | 'fat', boolean> = DEFAULT_VISIBLE_MACROS,
  variantIndex = 0,
): Recommendation {
  const timeLabel = TIME_LABELS[timeOfDay];
  const calories = Math.round(remainingCalories);

  if (remainingCalories <= 0) {
    return {
      mode: 'food',
      modeLabel: MODE_LABELS.food,
      timeLabel,
      headline: 'Tagesziel erreicht',
      suggestion: 'Du hast dein Kalorienziel bereits erreicht. Gönn deinem Körper jetzt lieber Ruhe statt Essen.',
      variantCount: 1,
    };
  }

  const allGaps: { key: 'protein' | 'carbs' | 'fat'; remaining: number }[] = [
    { key: 'protein', remaining: Math.max(remainingMacros.protein, 0) },
    { key: 'carbs', remaining: Math.max(remainingMacros.carbs, 0) },
    { key: 'fat', remaining: Math.max(remainingMacros.fat, 0) },
  ];
  const gaps = allGaps.filter((gap) => visibleMacros[gap.key]);
  const sortedGaps = [...gaps].sort((a, b) => b.remaining - a.remaining);
  const topGap = sortedGaps[0];
  const runnerUp = sortedGaps[1];
  const isBalanced = runnerUp !== undefined && topGap.remaining - runnerUp.remaining <= BALANCE_THRESHOLD_G;
  const isLowCalorie = remainingCalories <= LOW_CALORIE_THRESHOLD_KCAL;

  // Pick the food pool + headline for this state, without picking a specific variant yet -
  // its length feeds into the combined cross-mode variant count below.
  let foodPool: FoodTip[];
  let foodHeadline: string;
  let foodTemplate: (tip: FoodTip) => string;

  if (isLowCalorie) {
    foodPool = LOW_CALORIE_SNACKS;
    foodHeadline = `Noch ${calories} kcal übrig`;
    foodTemplate = (tip) => `${tip.text} ${passt(tip.plural)} gut zu den restlichen ${calories} kcal – leicht und sättigend.`;
  } else if (gaps.length === 0) {
    // Every macro is hidden - fall back to a balanced-meal pool that doesn't name any macro.
    foodPool = TIPS_BY_MACRO.balanced;
    foodHeadline = `Noch ${calories} kcal übrig`;
    foodTemplate = (tip) => `${tip.text} ${passt(tip.plural)} gut zu deinen verbleibenden ${calories} kcal.`;
  } else if (isBalanced) {
    foodPool = TIPS_BY_MACRO.balanced;
    foodHeadline = `Noch ${calories} kcal übrig`;
    foodTemplate = (tip) => `${tip.text} ${passt(tip.plural)} gut in dein verbleibendes Budget von ${calories} kcal.`;
  } else {
    foodPool = TIPS_BY_MACRO[topGap.key];
    foodHeadline = `Noch ${Math.round(topGap.remaining)}g ${MACRO_LABELS[topGap.key]} übrig`;
    foodTemplate = (tip) => `${tip.text} ${passt(tip.plural)} perfekt zu deinen verbleibenden ${calories} kcal.`;
  }

  const timingPool = TACTICAL_TIPS.filter((tip) => tip.times.includes(timeOfDay));
  const effectiveTimingPool = timingPool.length > 0 ? timingPool : TACTICAL_TIPS;

  const variantCount = foodPool.length + effectiveTimingPool.length + HYDRATION_TIPS.length;
  const index = ((variantIndex % variantCount) + variantCount) % variantCount;

  if (index < foodPool.length) {
    const tip = foodPool[index];
    return {
      mode: 'food',
      modeLabel: MODE_LABELS.food,
      timeLabel,
      headline: foodHeadline,
      suggestion: foodTemplate(tip),
      variantCount,
    };
  }

  if (index < foodPool.length + effectiveTimingPool.length) {
    const tip = effectiveTimingPool[index - foodPool.length];
    return {
      mode: 'timing',
      modeLabel: MODE_LABELS.timing,
      timeLabel,
      headline: tip.headline,
      suggestion: tip.suggestion,
      variantCount,
    };
  }

  const hydrationTip = pickVariant(HYDRATION_TIPS, index - foodPool.length - effectiveTimingPool.length);
  return {
    mode: 'hydration',
    modeLabel: MODE_LABELS.hydration,
    timeLabel,
    headline: hydrationTip.headline,
    suggestion: hydrationTip.suggestion,
    variantCount,
  };
}
