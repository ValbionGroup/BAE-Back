/**
 * Redaction for the request logger.
 *
 * The logger used to store `ctx.response.getBody()` verbatim, which meant every
 * access token minted by `/auth/login` and `/auth/signup` was written to the
 * `logs` table in clear text — and `GET /v1/logs` is readable by any
 * authenticated user. Two layers guard against that now:
 *
 *  1. whole routes whose responses are secrets by nature are never bodied;
 *  2. anything that survives is walked and secret-looking keys are masked.
 *
 * Layer 2 is a denylist and therefore best-effort: a new endpoint returning a
 * novel secret field leaks until its name is added here. Layer 1 is the real
 * guarantee, so prefer adding a route there when a response is sensitive.
 */

export const REDACTED = '[redacted]'

/** Substrings that make a key too sensitive to store, matched case-insensitively. */
const SECRET_KEY_PATTERNS = [
  'token',
  'password',
  'secret',
  'authorization',
  'hash',
  'apikey',
  'credential',
  'refresh',
] as const

/** URL fragments whose responses are never worth storing a body for. */
const SECRET_URL_PATTERNS = ['/auth/login', '/auth/signup', '/auth/logout', '/account/sessions']

/** Depth beyond which we stop descending, as a cheap cycle and blow-up guard. */
const MAX_DEPTH = 8

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function isSecretUrl(url: string): boolean {
  return SECRET_URL_PATTERNS.some((pattern) => url.includes(pattern))
}

/**
 * Recursively mask secret-looking values. Non-plain values (strings, numbers,
 * `null`) are returned untouched; everything else is rebuilt so the caller's
 * object is never mutated.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) {
    return REDACTED
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, depth + 1))
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      output[key] = isSecretKey(key) ? REDACTED : redactSecrets(entry, depth + 1)
    }
    return output
  }

  return value
}

/**
 * The `meta.response` to persist for a request, or `undefined` when the body
 * must not be stored at all.
 */
export function redactResponseBody(url: string, body: unknown): unknown {
  if (isSecretUrl(url)) {
    return undefined
  }
  return redactSecrets(body)
}
