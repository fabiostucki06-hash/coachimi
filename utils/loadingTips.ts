/**
 * Curated, minimalist tips shown on the loading screen - fitness, strict macro
 * tracking, nutrition, and a few Swiss-specific references (SGE food pyramid,
 * common Swiss protein staples) alongside the evidence-backed ones already
 * cited elsewhere in the app (utils/coachTips.ts, TrainingScienceTips.tsx),
 * so a user who's seen those doesn't hit a contradicting number here.
 */
export const LOADING_TIPS: string[] = [
  'Für Muskelaufbau optimiert eine Zufuhr von 1.6–2.2g Protein/kg Körpergewicht das Ergebnis (Morton et al., 2018).',
  '10–20 Sätze pro Muskelgruppe/Woche gelten als effektiver Trainingsbereich für Muskelaufbau (Schoenfeld et al., 2021).',
  'Vitamin C verbessert die Aufnahme von pflanzlichem (non-häm) Eisen deutlich (Hallberg et al.).',
  'EFSA empfiehlt 300–350mg Magnesium/Tag für Muskelregeneration und ATP-Synthese.',
  'Track jedes Gramm: Präzises Makro-Tracking schlägt Schätzen - schon 10% Abweichung verzögert den Fortschritt.',
  'Schweizer Teller-Modell: ½ Gemüse/Früchte, ¼ Stärke, ¼ Eiweiss - einfache Faustregel der SGE.',
  'Proteinreiche Schweizer Basics: Quark, Hüttenkäse und Bergkäse liefern hochwertiges Eiweiss pro Franken.',
  'Schlafmangel (<7h) senkt Kraftzuwachs und erhöht Hungerhormone messbar.',
  'Wasser vor der Mahlzeit unterstützt Sättigung - besonders im striktem Kaloriendefizit.',
  'NEAT (Alltagsbewegung) verbrennt oft mehr Kalorien als das Workout selbst - Treppe statt Lift.',
];

/** Picks a random tip, avoiding an immediate repeat of `exclude` when more than one tip exists. */
export function getRandomTip(exclude?: string): string {
  if (LOADING_TIPS.length <= 1) return LOADING_TIPS[0];

  let tip: string;
  do {
    tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  } while (tip === exclude);
  return tip;
}
