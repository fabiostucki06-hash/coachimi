// Free, keyless translation for Tier 3 of the hybrid food search (services/foodSearch.ts):
// a German query needs to reach USDA FoodData Central in English, and the English
// result names need to come back in German. MyMemory has no API key and a generous
// anonymous quota - fine for short food-name strings, not meant for bulk translation.
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';
const TRANSLATE_TIMEOUT_MS = 5000;

interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
}

/**
 * Translates `text` between two-letter language codes (e.g. 'de' -> 'en'). Best-effort:
 * on any failure (offline, timeout, bad response) returns the original text unchanged
 * rather than throwing, so a translation hiccup degrades Tier 3 instead of breaking it.
 */
export async function translateText(text: string, from: string, to: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);

  try {
    const url = `${TRANSLATE_URL}?q=${encodeURIComponent(trimmed)}&langpair=${from}|${to}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return trimmed;

    const data = (await response.json()) as MyMemoryResponse;
    const translated = data.responseData?.translatedText;
    return translated ? translated.trim() : trimmed;
  } catch {
    return trimmed;
  } finally {
    clearTimeout(timeout);
  }
}

export function translateDeToEn(text: string): Promise<string> {
  return translateText(text, 'de', 'en');
}

export function translateEnToDe(text: string): Promise<string> {
  return translateText(text, 'en', 'de');
}
