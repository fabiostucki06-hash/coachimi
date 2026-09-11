export interface ReleaseNote {
  version: string;
  date: string;
  highlights: string[];
}

// Newest first. Kept short and user-facing (no internal file/function names) -
// this is the "what's new" list shown in-app, not a commit log.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.4.0',
    date: '2026-09-11',
    highlights: [
      'Neu: Portionsgrößen-Auswahl beim Eintragen (z. B. "1 großer Apfel ~200g")',
      'Neu: Mahlzeiten und einzelne Einträge lassen sich auf ein anderes Datum kopieren',
      'Neu: Mehrtägige Nährstoff-Analyse auf dem Dashboard (Eisen, Protein, Ballaststoffe, Magnesium)',
      'Neu: "Letztes Mal"-Anzeige auf der Trainingskarte zeigt dein voriges Gewicht × Wiederholungen',
      'Verbessert: Neue Trainingstage starten ohne vorausgefüllte Sätze - Sätze werden aktiv hinzugefügt',
      'Verbessert: KI-Fotoanalyse und KI-Schätzung erfassen jetzt auch den Eisengehalt',
      'Verbessert: robusteres Einlesen von KI-Antworten, falls das JSON-Format leicht abweicht',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-20',
    highlights: [
      'Neu: Gold Bars Belohnungssystem mit Shop, Rängen und Abzeichen',
      'Neu: Home-Screen-Widget mit Live-Kalorienstand',
      'Verbessert: Streak- und Rang-Fortschritt wird mit Supabase synchronisiert',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-07-30',
    highlights: [
      'Neu: Inline-Bearbeitung von Mahlzeiten-Einträgen',
      'Verbessert: Lebensmittelsuche deckt deutlich mehr Treffer über Open Food Facts ab',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-05',
    highlights: [
      'Neu: KI-Foto-Analyse und KI-Text-Erfassung für Mahlzeiten',
      'Neu: Coach-Tipps mit Timing- und Hydration-Modus',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-01',
    highlights: ['Start von Coach imi: Ernährungstagebuch, Trainingsplaner und Profil'],
  },
];
