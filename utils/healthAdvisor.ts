export interface AdvisorTip {
  id: string;
  step: string;
}

interface AdvisorRule {
  id: string;
  keywords: RegExp;
  tips: string[];
}

// Keyword -> canned, science-based health/fitness tips. Order matters: first
// matching rule wins, so more specific keywords should sit above generic ones.
const RULES: AdvisorRule[] = [
  {
    id: 'recovery',
    keywords: /muskelkater|regenerat|erholung|schmerz|soreness|doms/i,
    tips: [
      '7-9h Schlaf priorisieren - der Großteil der Erholung passiert im Tiefschlaf.',
      'Ausreichend Wasser trinken und Elektrolyte im Blick behalten, besonders nach intensivem Training.',
      'Proteinzufuhr sichern (1.6-2.2g/kg Körpergewicht/Tag), um Muskelreparatur zu unterstützen.',
      'Leichte Bewegung (Spaziergang, lockeres Radfahren) fördert die Durchblutung und beschleunigt die Erholung.',
    ],
  },
  {
    id: 'plateau',
    keywords: /plateau|stagnier|abnehmen|gewichtsverlust|kein fortschritt|nicht ab/i,
    tips: [
      'Kalorienerfassung 1-2 Wochen genau kontrollieren - Portionsgrößen und "unsichtbare" Kalorien (Öl, Snacks) sind häufige Ursachen.',
      'NEAT (Alltagsbewegung wie Gehen, Treppen) erhöhen, wenn das Trainingspensum bereits hoch ist.',
      'Ein geplanter Refeed-Tag (kurzfristig auf Erhaltungskalorien) kann Stoffwechsel und Motivation unterstützen.',
      'Stresslevel und Schlafqualität prüfen - chronischer Stress erschwert Fettabbau über Cortisol.',
    ],
  },
  {
    id: 'hypertrophy',
    keywords: /muskelaufbau|hypertrophie|muskeln aufbauen|masse aufbauen|kraft/i,
    tips: [
      'Progressive Overload: Gewicht, Wiederholungen oder Sätze regelmäßig steigern, um kontinuierlichen Reiz zu setzen.',
      'Proteinzufuhr von 1.6-2.2g/kg Körpergewicht/Tag, gleichmäßig über den Tag verteilt.',
      '7-9h Schlaf pro Nacht - Wachstumshormon-Ausschüttung ist im Schlaf am höchsten.',
      'Leichten Kalorienüberschuss (~200-300 kcal) einplanen, um Muskelaufbau ohne übermäßigen Fettzuwachs zu unterstützen.',
    ],
  },
  {
    id: 'energy-sleep',
    keywords: /energie|müde|schlaf|morgens|erschöpft|antriebslos/i,
    tips: [
      'Direkt nach dem Aufwachen ein großes Glas Wasser trinken - leichte Dehydrierung ist eine häufige Müdigkeitsursache.',
      'Koffein erst 60-90 Minuten nach dem Aufwachen konsumieren, um den natürlichen Cortisolanstieg nicht zu stören.',
      'Magnesium (z. B. über Nüsse, Vollkorn, grünes Blattgemüse) unterstützt Schlafqualität und Muskelentspannung.',
      'Feste Schlafenszeiten einhalten, auch am Wochenende - ein konsistenter Rhythmus verbessert die Schlafqualität stärker als reine Schlafdauer.',
    ],
  },
];

const DEFAULT_TIPS: string[] = [
  'Auf eine ausgewogene Ernährung mit ausreichend Protein, Ballaststoffen und Mikronährstoffen achten.',
  '7-9h Schlaf pro Nacht und regelmäßige Bewegung sind die Basis für die meisten Gesundheitsziele.',
  'Frage möglichst konkret formulieren (z. B. "Tipps gegen Muskelkater" statt "Hilfe"), für gezieltere Antworten.',
];

/** Rule-based (no network/LLM call) health & fitness guidance: matches keywords in the user's free-text question to canned, science-based tips. */
export function getHealthAdvice(text: string): AdvisorTip[] {
  const rule = RULES.find((candidate) => candidate.keywords.test(text));
  const tips = rule?.tips ?? DEFAULT_TIPS;
  return tips.map((step, index) => ({ id: `${rule?.id ?? 'default'}-${index}`, step }));
}
