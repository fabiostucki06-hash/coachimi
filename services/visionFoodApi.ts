import { parseJsonLoose } from '@/services/aiJson';
import type { Macros, Micronutrients } from '@/types';
import { estimateFructoseFromSugar } from '@/utils/nutritionCalculator';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface DetectedFoodItem {
  name: string;
  cookingMethod: string | null;
  estimatedGrams: number;
  caloriesPer100g: number;
  macrosPer100g: Macros;
  micronutrientsPer100g: Micronutrients;
  confidence: number;
  confidenceTier: ConfidenceTier;
  needsVerification: boolean;
  /** Grams of cooking oil/butter/fat the model inferred from visual cues (sheen, crust, greasy plate edge) - already folded into fatPer100g/caloriesPer100g above, surfaced separately so the review UI can show it as its own "[Gekocht in Öl: ~Xg Fett]" tag instead of hiding it inside one opaque number. 0 when no hidden-fat indicator was detected. */
  hiddenFatGrams: number;
  /** 1-2 alternative names the model considered when the component's IDENTITY (not just its quantity) was ambiguous, e.g. ['Rindfleisch', 'Schweinefleisch'] - drives the quick-confirm chips in the review UI. Empty when identity was clear. */
  nameAlternatives: string[];
}

export interface VisionAnalysisResult {
  items: DetectedFoodItem[];
  notice: string | null;
  source: 'ai' | 'fallback';
  confidenceScore: number;
  reasoning: string | null;
}

class VisionAnalysisError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'VisionAnalysisError';
  }
}

// Set via EXPO_PUBLIC_OPENAI_API_KEY at build time to enable real Vision analysis.
// Client-exposed by design (EXPO_PUBLIC_ vars ship in the JS bundle) - only use a
// low-scoped/throwaway key, never a production secret, for this demo integration.
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const VISION_TIMEOUT_MS = 25000;
const LOW_CONFIDENCE_THRESHOLD = 0.55;
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

/** Buckets a raw 0-1 confidence into the three tiers the review UI shows (High/Medium/Low) instead of a bare percentage - same LOW_CONFIDENCE_THRESHOLD boundary needsVerification already uses, so a "needs verification" item is always at most 'medium'. */
export function toConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

const ANALYSIS_SCHEMA_PROMPT = `Du bist ein Ernährungsexperte mit Fokus auf präzise Bildanalyse von Mahlzeiten.

Analysiere das Foto Stück für Stück, nicht als Ganzes:
1. Zerlege die Mahlzeit in ihre einzelnen erkennbaren Lebensmittel/Komponenten - Hauptkomponente (Protein), Kohlenhydratquelle,
   Gemüse/Salat, UND separat auch Saucen, Dressings, Dips und Beilagen, die eigene Nährwerte haben (z. B. "Hähnchenbrust",
   "Reis", "Brokkoli", "Sojasauce" statt nur "Teller mit Essen").
2. Bestimme für jede Komponente die Zubereitungsart (z. B. gebraten, gekocht, roh, frittiert, paniert), falls erkennbar.
3. Schätze für jede Komponente das Volumen (in cm³, ml bei Flüssigem/Suppen) über räumliche Referenzanker im Bild -
   primär der Tellerdurchmesser (Standard-Esstellerdurchmesser ca. 26cm, Beilagenteller ca. 20cm), ergänzt um Besteck
   (Gabel ca. 18-20cm, Löffel-Kopf ca. 4x7cm), Gläser, Hände/Finger als Sekundär-Maßstab. Rechne das geschätzte Volumen
   über eine typische Dichte (g/cm³) für die jeweilige Lebensmittelgruppe in Gramm um (Richtwerte: Fleisch/Fisch gegart
   ~1.0-1.1, gekochter Reis/Getreide ~0.9, Blattsalat/Rohgemüse ~0.3-0.4, gegartes Gemüse ~0.6-0.8, Saucen/Dips ~1.0-1.05,
   frittierte/panierte Komponenten ~0.5-0.6 wegen Lufteinschluss) statt grob zu schätzen.
4. Erkenne versteckte/unsichtbare Fette, die auf dem Foto nicht als eigenes Objekt sichtbar sind, aber die Nährwerte
   deutlich verändern: Brat-/Frittieröl, Butter, Sahne, Dressing-Reste, Marinade. Nutze visuelle Hinweise (Glanz/
   Schlieren auf der Oberfläche, angebratene Kruste, öliger Tellerrand, sichtbare Pfanne/Fritteuse im Bild) als Indiz.
   Liegt eine Zubereitungsart wie "gebraten", "frittiert" oder "paniert" vor und zeigt das Bild eines dieser Indizien,
   gehe von mindestens 1 Esslöffel (ca. 10-15g) verstecktem Öl/Fett pro Portion aus. Anders als bisher NICHT als eigene
   Komponente auflisten, sondern direkt am betroffenen Item über "hiddenFatGrams" ausweisen (0, wenn kein Hinweis auf
   verstecktes Fett vorliegt) - das Fett fließt trotzdem in die Nährwerte (fatPer100g etc.) dieser Komponente ein.
5. Schätze für jede Komponente die Nährwerte pro 100g möglichst genau. Schlüssle "sugarPer100g" (Gesamtzucker) zusätzlich
   in "fructosePer100g" (Fruchtzucker) auf - der Anteil speziell aus Früchten, Honig oder High-Fructose-Corn-Syrup.
   fructosePer100g ist ein TEIL von sugarPer100g, niemals zusätzlich dazu zu zählen. Kennst du bei Obst/Beeren keinen
   genauen Wert, schätze fructosePer100g konservativ als ~50% von sugarPer100g statt 0 anzugeben (0 nur, wenn die
   Komponente erkennbar KEIN Frucht-/Honig-/Sirup-Zucker enthält, z. B. Fleisch, Gemüse ohne Zuckerzusatz).
6. Gib für jede Komponente eine confidence zwischen 0 und 1 an, wie sicher du dir bei Erkennung UND Mengenschätzung bist.
   Ist die Kalorien-/Mengenschätzung unsicher, aber die IDENTITÄT der Komponente selbst mehrdeutig (z. B. Rind- vs.
   Schweinefleisch bei einem panierten Schnitzel, Vollmilch- vs. Magerjoghurt), liste die 1-2 wahrscheinlichsten
   Alternativnamen in "nameAlternatives" (sonst leeres Array) - NICHT verwenden für reine Mengen-Unsicherheit.
7. Gib zusätzlich eine Gesamt-confidenceScore (0-1) für die ganze Analyse an, sowie eine kurze "reasoning" (1-2 Sätze,
   Deutsch) die knapp erklärt, wie Mengen/verstecktes Fett geschätzt wurden (z. B. welche Referenzgrößen benutzt
   wurden, ob Öl angenommen wurde).

Falls das Bild unscharf, zu dunkel, teilweise verdeckt oder anderweitig schwer auswertbar ist: gib trotzdem deine
beste konservative Schätzung ab (niemals verweigern), aber setze die confidence/confidenceScore entsprechend niedrig
und fülle "qualityNotice" mit einem kurzen deutschen Hinweis, dass der Nutzer die Werte prüfen soll.

Falls das Bild klar erkennbar KEIN Lebensmittel zeigt, setze "isFoodImage" auf false und "items" auf ein leeres Array.

Antworte ausschließlich mit kompaktem JSON in genau diesem Schema, ohne weitere Erklärung, ohne Markdown:
{
  "isFoodImage": boolean,
  "qualityNotice": string | null,
  "confidenceScore": number,
  "reasoning": string | null,
  "items": [
    {
      "name": string,
      "cookingMethod": string | null,
      "estimatedGrams": number,
      "confidence": number,
      "hiddenFatGrams": number,
      "nameAlternatives": string[],
      "caloriesPer100g": number,
      "carbsPer100g": number,
      "proteinPer100g": number,
      "fatPer100g": number,
      "fiberPer100g": number,
      "sugarPer100g": number,
      "fructosePer100g": number,
      "sodiumPer100gMg": number,
      "vitaminCPer100gMg": number,
      "ironPer100gMg": number,
      "calciumPer100gMg": number,
      "vitaminB12Per100gMcg": number,
      "vitaminDPer100gMcg": number,
      "zincPer100gMg": number,
      "magnesiumPer100gMg": number,
      "potassiumPer100gMg": number
    }
  ]
}`;

interface OpenAiVisionItemJson {
  name?: string;
  cookingMethod?: string | null;
  estimatedGrams?: number;
  confidence?: number;
  hiddenFatGrams?: number;
  nameAlternatives?: string[];
  caloriesPer100g?: number;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  fructosePer100g?: number;
  sodiumPer100gMg?: number;
  vitaminCPer100gMg?: number;
  ironPer100gMg?: number;
  calciumPer100gMg?: number;
  vitaminB12Per100gMcg?: number;
  vitaminDPer100gMcg?: number;
  zincPer100gMg?: number;
  magnesiumPer100gMg?: number;
  potassiumPer100gMg?: number;
}

interface OpenAiVisionJson {
  isFoodImage?: boolean;
  qualityNotice?: string | null;
  confidenceScore?: number;
  reasoning?: string | null;
  items?: OpenAiVisionItemJson[];
}

function toNonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) >= 0 ? (value as number) : fallback;
}

function toConfidence(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value as number));
}

/**
 * Client-side safety net for the ~50%-of-sugar fructose fallback (see
 * ANALYSIS_SCHEMA_PROMPT step 5 and utils/nutritionCalculator.ts's
 * estimateFructoseFromSugar) in case the model reports a sugar value but skips
 * fructosePer100g entirely rather than following the prompt's own fallback
 * instruction - not the primary mechanism, just a backstop.
 */
function resolveFructose(name: string, sugar: number, rawFructose: number | undefined): number {
  if (Number.isFinite(rawFructose) && (rawFructose as number) > 0) return rawFructose as number;
  return estimateFructoseFromSugar(name, sugar);
}

function normalizeDetectedItem(raw: OpenAiVisionItemJson): DetectedFoodItem {
  const confidence = toConfidence(raw.confidence);
  const name = raw.name?.trim() || 'Erkanntes Lebensmittel';
  const sugar = toNonNegative(raw.sugarPer100g, 0);
  return {
    name,
    cookingMethod: raw.cookingMethod?.trim() || null,
    estimatedGrams: toNonNegative(raw.estimatedGrams, 150),
    caloriesPer100g: toNonNegative(raw.caloriesPer100g, 0),
    macrosPer100g: {
      carbs: toNonNegative(raw.carbsPer100g, 0),
      protein: toNonNegative(raw.proteinPer100g, 0),
      fat: toNonNegative(raw.fatPer100g, 0),
    },
    micronutrientsPer100g: {
      fiber: toNonNegative(raw.fiberPer100g, 0),
      sugar,
      fructose: resolveFructose(name, sugar, raw.fructosePer100g),
      sodium: toNonNegative(raw.sodiumPer100gMg, 0),
      vitaminC: toNonNegative(raw.vitaminCPer100gMg, 0),
      iron: toNonNegative(raw.ironPer100gMg, 0),
      calcium: toNonNegative(raw.calciumPer100gMg, 0),
      vitaminB12: toNonNegative(raw.vitaminB12Per100gMcg, 0),
      vitaminD: toNonNegative(raw.vitaminDPer100gMcg, 0),
      zinc: toNonNegative(raw.zincPer100gMg, 0),
      magnesium: toNonNegative(raw.magnesiumPer100gMg, 0),
      potassium: toNonNegative(raw.potassiumPer100gMg, 0),
    },
    confidence,
    confidenceTier: toConfidenceTier(confidence),
    needsVerification: confidence < LOW_CONFIDENCE_THRESHOLD,
    hiddenFatGrams: toNonNegative(raw.hiddenFatGrams, 0),
    nameAlternatives: (raw.nameAlternatives ?? []).map((name) => name.trim()).filter(Boolean).slice(0, 2),
  };
}

async function analyzeWithOpenAi(base64Image: string): Promise<VisionAnalysisResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 1200,
        temperature: 0.2,
        messages: [
          { role: 'system', content: ANALYSIS_SCHEMA_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analysiere diese Mahlzeit Komponente für Komponente.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'high' } },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new VisionAnalysisError('Zeitüberschreitung bei der Bildanalyse.', error);
    }
    throw new VisionAnalysisError('Netzwerkfehler bei der Bildanalyse.', error);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new VisionAnalysisError(`Vision-API antwortete mit Status ${response.status}.`);
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = await response.json();
  } catch (error) {
    throw new VisionAnalysisError('Antwort der Vision-API konnte nicht gelesen werden.', error);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new VisionAnalysisError('Keine Antwort von der Vision-API erhalten.');
  }

  const parsed = parseJsonLoose<OpenAiVisionJson>(content);
  if (!parsed) {
    throw new VisionAnalysisError('Antwort der Vision-API war kein gültiges JSON.');
  }

  if (parsed.isFoodImage === false || !parsed.items?.length) {
    return {
      items: [],
      notice: 'Kein Lebensmittel erkannt. Bitte ein anderes Foto wählen oder manuell hinzufügen.',
      source: 'ai',
      confidenceScore: 0,
      reasoning: null,
    };
  }

  const items = parsed.items.map(normalizeDetectedItem);
  const hasLowConfidenceItem = items.some((item) => item.needsVerification);
  const notice =
    parsed.qualityNotice?.trim() ||
    (hasLowConfidenceItem ? 'Erkennung unsicher – bitte Mengen und Nährwerte vor dem Speichern prüfen.' : null);
  const confidenceScore = Number.isFinite(parsed.confidenceScore)
    ? toConfidence(parsed.confidenceScore)
    : toConfidence(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);

  return { items, notice, source: 'ai', confidenceScore, reasoning: parsed.reasoning?.trim() || null };
}

/** Generic estimate used when no API key is configured or the Vision API call fails. */
function fallbackEstimate(notice: string): VisionAnalysisResult {
  return {
    items: [
      {
        name: 'Mahlzeit (Schätzung)',
        cookingMethod: null,
        estimatedGrams: 250,
        caloriesPer100g: 220,
        macrosPer100g: { carbs: 24, protein: 10, fat: 9 },
        micronutrientsPer100g: { fiber: 3, sugar: 5, fructose: 2, sodium: 280, vitaminC: 4, iron: 1 },
        confidence: 0.3,
        confidenceTier: toConfidenceTier(0.3),
        needsVerification: true,
        hiddenFatGrams: 0,
        nameAlternatives: [],
      },
    ],
    notice,
    source: 'fallback',
    confidenceScore: 0.3,
    reasoning: null,
  };
}

export async function analyzeFoodPhoto(base64Image: string): Promise<VisionAnalysisResult> {
  if (!OPENAI_API_KEY) {
    return fallbackEstimate('Keine KI-Analyse konfiguriert – bitte Schätzwerte anpassen.');
  }

  try {
    return await analyzeWithOpenAi(base64Image);
  } catch (error) {
    const message = error instanceof VisionAnalysisError ? error.message : 'Bildanalyse fehlgeschlagen.';
    return fallbackEstimate(`${message} Bitte Schätzwerte anpassen.`);
  }
}
