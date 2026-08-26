export const REDACTED = '[redacted]'

// A denylist, therefore best-effort at most: a new secret field leaks until its
// name is added here. The real guarantee is `SECRET_URL_PATTERNS`, to be
// preferred whenever a whole response is sensitive.
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

const SECRET_URL_PATTERNS = [
  '/auth/login',
  '/auth/signup',
  '/auth/logout',
  '/account/sessions',
  '/auth/keycloak/callback',
]

// Whole parameter names, not substrings as in `SECRET_KEY_PATTERNS`: a query
// string carries `?barcode=` next to `?code=`, and a substring match would
// blind the stocks logs to protect nothing.
const SECRET_QUERY_PARAMS = new Set([
  'code',
  'state',
  'session_state',
  'nonce',
  'signature',
  'key',
  'id_token',
  'access_token',
  'refresh_token',
])

const MAX_DEPTH = 8

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function isSecretUrl(url: string): boolean {
  return SECRET_URL_PATTERNS.some((pattern) => url.includes(pattern))
}

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

export function redactResponseBody(url: string, body: unknown): unknown {
  if (isSecretUrl(url)) {
    return undefined
  }
  return redactSecrets(body)
}

/**
 * Masks the secrets a query string carries, keeping the path and the harmless
 * parameters readable.
 *
 * ⚠️ Redacting the response body is not enough: `request_logger_middleware`
 * stores the full url in `logs.url` **and** in `logs.message`, so a
 * `GET /v1/auth/keycloak/callback?code=…` used to write the SSO authorization
 * code in clear in two columns, readable with `log:read`.
 */
export function redactUrl(url: string): string {
  const separator = url.indexOf('?')
  if (separator === -1) {
    return url
  }

  const path = url.slice(0, separator)
  const query = url.slice(separator + 1)
  if (query === '') {
    return path
  }

  const params = new URLSearchParams(query)
  for (const name of [...params.keys()]) {
    if (SECRET_QUERY_PARAMS.has(name.toLowerCase()) || isSecretKey(name)) {
      params.set(name, REDACTED)
    }
  }

  return `${path}?${params.toString()}`
}
