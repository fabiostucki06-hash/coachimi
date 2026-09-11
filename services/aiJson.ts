/**
 * Best-effort JSON parse for LLM responses. Despite every prompt in this app instructing
 * "JSON only, no markdown", models occasionally still wrap the object in a code fence or
 * add a stray sentence before/after it - rather than fail the whole analysis, fall back to
 * extracting the first `{...}` block and parsing that instead of the raw string.
 */
export function parseJsonLoose<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
