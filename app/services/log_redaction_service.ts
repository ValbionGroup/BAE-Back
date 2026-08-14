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

const SECRET_URL_PATTERNS = ['/auth/login', '/auth/signup', '/auth/logout', '/account/sessions']

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
