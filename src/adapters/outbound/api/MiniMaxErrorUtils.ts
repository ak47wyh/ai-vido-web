/**
 * MiniMax API error code mapping.
 * Shared across all MiniMax adapters for consistent error messages.
 */
const MINIMAX_ERROR_CODES: Record<number, string> = {
  1002: 'Rate limited — please try again later',
  1004: 'Authentication failed — check your API Key',
  1008: 'Insufficient account balance',
  1026: 'Prompt contains sensitive content — please revise',
  2013: 'Invalid parameters — check your request',
  2049: 'Invalid API Key',
};

/**
 * Build a human-readable error message from MiniMax API base_resp.
 */
export function getMiniMaxErrorMessage(
  statusCode: number | undefined,
  statusMsg?: string,
  prefix = 'MiniMax API error'
): string | null {
  if (statusCode === undefined || statusCode === 0) return null;
  const msg = MINIMAX_ERROR_CODES[statusCode] || statusMsg || `API error (code ${statusCode})`;
  return `${prefix}: ${msg}`;
}
