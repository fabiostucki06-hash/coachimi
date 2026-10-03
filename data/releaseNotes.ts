export interface ReleaseNote {
  version: string;
  date: string;
  highlights: string[];
}

// Newest first. Kept short and user-facing (no internal file/function names) -
// this is the "what's new" list shown in-app, not a commit log.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.5.6',
    date: '2026-10-03',
    highlights: [
      'Verbessert: KI-Fotoanalyse erkennt Schweizer/europäische Produkte (z. B. Gruyère statt "Swiss Cheese") und schätzt Portionen jetzt zuerst in Alltagsmass ("1 Riegel", "1 Portion Pasta") statt direkt in Gramm',
      'Verbessert: bei unsicherer Erkennung schlägt die KI jetzt bis zu 3 konkrete Alternativen statt einer vagen Schätzung vor',
    ],
  },
  {
    version: '1.5.5',
    date: '2026-10-03',
    highlights: [
      'Fix: Freitext-Eintrag erkennt "Riegel", "Packung" und "Dose" jetzt als Mengeneinheit (z. B. "1 Riegel Proteinriegel") statt sie fälschlich zum Produktnamen zu zählen',
    ],
  },
  {
    version: '1.5.4',
    date: '2026-10-03',
    highlights: [
      'Neu: Portionsgrößen-Auswahl für Joghurt, Quark/Hüttenkäse, Pudding und Thunfisch (Dose) - direkt als Becher/Dose statt nur in Gramm',
    ],
  },
  {
    version: '1.5.3',
    date: '2026-10-03',
    highlights: [
      'Verbessert: Lebensmittelsuche und KI-Fotoerkennung bevorzugen jetzt europäische/Schweizer Datenbanken (Open Food Facts, FatSecret) klarer vor der US-amerikanischen USDA-Datenbank',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-10-03',
    highlights: [
      'Neu: Push-Erinnerungen sind jetzt kontextbezogen - sie zeigen, wie viel Protein/Kalorien du heute schon getrackt hast, plus motivierende Sprüche',
      'Fix: der "schon lange nichts eingetragen"-Hinweis feuerte fälschlich bei jedem Hard-Refresh erneut - jetzt nur noch über den geplanten Intervall-Check',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-10-03',
    highlights: [
      'Verbessert: KI-Fotoanalyse erkennt Mahlzeiten jetzt genauer - höhere Bildqualität vor dem Upload, kein erzwungener Bildausschnitt mehr',
      'Verbessert: KI-Schätzung gleicht Kalorien und Makros gegeneinander ab, um unplausible Werte zu vermeiden',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-03',
    highlights: [
      'Neu: Mahlzeiten und einzelne Einträge lassen sich jetzt auch in einen anderen Mahlzeiten-Slot kopieren (z. B. Frühstück -> Mittagessen)',
      'Neu: Ganze Mahlzeiten lassen sich mit Freunden teilen, nicht nur einzelne Lebensmittel - die Vorschau zeigt dabei die Nährwerte, die dein Freund selbst in seinem Profil ausgewählt hat',
      'Verbessert: Eisenwerte in der lokalen Lebensmittel-Datenbank korrigiert; Proteinpulver, Kümmelöl, Reis (ungekocht) und weitere Brotsorten ergänzt',
    ],
  },
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
