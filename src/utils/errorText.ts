/**
 * Readable text for a caught value of unknown type: an Error's message, a string as is, and JSON
 * for anything else, so a rejected plain object does not show as "[object Object]".
 */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? 'undefined';
  } catch {
    return 'Unserializable error value';
  }
}
