/**
 * Extract a human-readable error message from an unknown error value.
 * Standardizes error handling across the UI layer.
 */
export function getErrorMessage(e: unknown, fallback = 'Unknown error'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return fallback;
}
