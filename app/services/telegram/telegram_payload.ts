/** L'échec d'un envoi, trié par ce que le distributeur doit en faire. */
export type SendFailure = {
  kind: 'permanent' | 'transient'
  status: number
  description: string
  retryAfterSeconds: number | null
}

export type SendOutcome = { ok: true } | ({ ok: false } & SendFailure)

export type ReceivedUpdate = { updateId: number; raw: unknown }

export type IncomingCommand = {
  chatId: number
  username: string | null
  command: 'start' | 'stop'
  argument: string | null
}

/**
 * Descriptions par lesquelles Telegram dit qu'un chat ne recevra plus rien. Un
 * 400 les porte parfois, d'où la recherche dans le texte plutôt que sur le code.
 */
const GONE_FOR_GOOD = [
  'bot was blocked',
  'chat not found',
  'user is deactivated',
  'bot was kicked',
  'peer_id_invalid',
]

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Le **seul** endroit du dépôt qui connaisse le vocabulaire de Telegram.
 *
 * ⚠️ Les clés sont en `snake_case` telles que Telegram les écrit. Le webhook doit
 * donc lire `request.raw()` : `case_converter_middleware` s'applique à toutes les
 * routes et camélifierait le corps, alors que `getUpdates` ne passe pas par lui.
 *
 * Rend `null` pour tout ce qui n'est pas une commande connue en conversation privée.
 */
export function parseUpdate(raw: unknown): IncomingCommand | null {
  const update = asRecord(raw)
  const message = asRecord(update?.message)
  const chat = asRecord(message?.chat)
  const from = asRecord(message?.from)
  const text = message?.text

  if (chat === null || typeof text !== 'string') return null
  if (chat.type !== 'private' || typeof chat.id !== 'number') return null

  const [head, ...rest] = text.trim().split(/\s+/)
  const command = head.replace(/@.*$/, '').toLowerCase()
  if (command !== '/start' && command !== '/stop') return null

  const argument = rest.join('').toUpperCase()

  return {
    chatId: chat.id,
    username: typeof from?.username === 'string' ? from.username : null,
    command: command === '/start' ? 'start' : 'stop',
    argument: argument === '' ? null : argument,
  }
}

export function classifySendFailure(status: number, body: unknown): SendFailure {
  const payload = asRecord(body)
  const description = typeof payload?.description === 'string' ? payload.description : ''
  const parameters = asRecord(payload?.parameters)
  const retryAfter = parameters?.retry_after

  if (status === 429) {
    return {
      kind: 'transient',
      status,
      description,
      retryAfterSeconds: typeof retryAfter === 'number' ? retryAfter : null,
    }
  }

  if (status >= 500) return { kind: 'transient', status, description, retryAfterSeconds: null }

  const lowered = description.toLowerCase()
  const gone = status === 403 || GONE_FOR_GOOD.some((needle) => lowered.includes(needle))

  return {
    kind: gone || status < 500 ? 'permanent' : 'transient',
    status,
    description,
    retryAfterSeconds: null,
  }
}
