export interface PortionUnit {
  id: string;
  label: string;
  grams: number;
}

/** Common household portion presets - tapping one sets the gram amount directly instead of requiring the user to weigh/estimate grams themselves. Generic across foods (not tied to a specific item), same approach `mealTextParser.ts` uses for "EL"/"TL". */
export const PORTION_UNITS: PortionUnit[] = [
  { id: 'apple_large', label: '1 großer Apfel', grams: 200 },
  { id: 'apple_small', label: '1 kleiner Apfel', grams: 120 },
  { id: 'bar', label: '1 Riegel', grams: 45 },
  { id: 'slice', label: '1 Scheibe', grams: 35 },
  { id: 'portion', label: '1 Portion', grams: 250 },
  { id: 'egg', label: '1 Ei', grams: 55 },
  { id: 'handful', label: '1 Handvoll', grams: 30 },
  { id: 'tbsp', label: '1 EL', grams: 15 },
  { id: 'tsp', label: '1 TL', grams: 5 },
];
