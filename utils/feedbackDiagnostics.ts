export interface DiagnosticTip {
  id: string;
  step: string;
}

interface DiagnosticRule {
  id: string;
  keywords: RegExp;
  tips: string[];
}

// Keyword -> canned, actionable troubleshooting steps. Order matters: first
// matching rule wins, so more specific keywords should sit above generic ones.
const RULES: DiagnosticRule[] = [
  {
    id: 'sync',
    keywords: /sync|synchron|cloud|geräte/i,
    tips: [
      'Internetverbindung prüfen und "Jetzt synchronisieren" im Tagebuch antippen.',
      'Falls das nicht hilft: in Profil > Konto ab- und wieder anmelden, um die Verbindung neu aufzubauen.',
      'Bleibt der Fehler bestehen, App vollständig schließen und neu starten.',
    ],
  },
  {
    id: 'camera',
    keywords: /kamera|scanner|barcode|foto/i,
    tips: [
      'Kamera-Berechtigung in den Geräteeinstellungen für die App prüfen.',
      'Barcode näher an die Kamera halten und auf gute Beleuchtung achten.',
      'Bei anhaltenden Problemen: App neu starten, damit die Kamera neu initialisiert wird.',
    ],
  },
  {
    id: 'search',
    keywords: /suche|lebensmittel|essen|nicht gefunden|search/i,
    tips: [
      '"Eigenes Lebensmittel erstellen" nutzen, wenn ein Produkt fehlt.',
      'Suchbegriff vereinfachen (z. B. nur "Joghurt" statt Markenname).',
      'Bei Online-Suche: Internetverbindung prüfen, offline sind nur lokale/eigene Lebensmittel verfügbar.',
    ],
  },
  {
    id: 'performance',
    keywords: /langsam|lag|ruckel|hängt|performance|freeze|abstürz|crash/i,
    tips: [
      'App vollständig schließen (nicht nur in den Hintergrund) und neu öffnen.',
      'Gerät neu starten, falls mehrere Apps gleichzeitig offen sind.',
      'Bei wiederholten Abstürzen: Datum/Uhrzeit des Vorfalls notieren, hilft bei der Fehlersuche.',
    ],
  },
  {
    id: 'goals',
    keywords: /ziel|kalorien|makro|berechnung/i,
    tips: [
      'Körperdaten und Aktivitätslevel in Profil > Körperdaten prüfen - sie bestimmen die Zielberechnung.',
      'Ziele lassen sich in Profil > Ziele auch manuell überschreiben.',
    ],
  },
];

const DEFAULT_TIPS: string[] = [
  'App vollständig schließen und neu starten - löst die meisten kurzfristigen Störungen.',
  'Prüfen, ob eine neuere App-Version verfügbar ist.',
  'Beschreibung möglichst konkret formulieren (z. B. "Sync hängt" statt "geht nicht"), damit gezieltere Tipps möglich sind.',
];

/** Rule-based (no network/LLM call) troubleshooting: matches keywords in the user's free-text report to canned, actionable steps. */
export function diagnoseFeedback(text: string): DiagnosticTip[] {
  const rule = RULES.find((candidate) => candidate.keywords.test(text));
  const tips = rule?.tips ?? DEFAULT_TIPS;
  return tips.map((step, index) => ({ id: `${rule?.id ?? 'default'}-${index}`, step }));
}
