import { test } from '@japa/runner'
import { classifySendFailure, parseUpdate } from '#services/telegram/telegram_payload'

/** Un update tel que Telegram l'envoie : **snake_case**, jamais autre chose. */
function update(text: string, overrides: Record<string, unknown> = {}) {
  return {
    update_id: 42,
    message: {
      message_id: 7,
      chat: { id: 123456789, type: 'private' },
      from: { id: 123456789, is_bot: false, first_name: 'Léa', username: 'lea_m' },
      text,
      ...overrides,
    },
  }
}

test.group('Charge utile Telegram — décodage', () => {
  test('reconnaît /start et son argument', ({ assert }) => {
    assert.deepEqual(parseUpdate(update('/start K7M3QZ8XW2VP')), {
      chatId: 123456789,
      username: 'lea_m',
      command: 'start',
      argument: 'K7M3QZ8XW2VP',
    })
  })

  /** Telegram suffixe la commande du nom du bot dès qu'un groupe est en jeu. */
  test('tolère la forme suffixée du nom du bot', ({ assert }) => {
    assert.equal(parseUpdate(update('/start@bae_bot K7M3QZ8XW2VP'))?.argument, 'K7M3QZ8XW2VP')
  })

  test('normalise le code en majuscules', ({ assert }) => {
    assert.equal(parseUpdate(update('/start k7m3qz8xw2vp'))?.argument, 'K7M3QZ8XW2VP')
  })

  test('reconnaît /start sans argument', ({ assert }) => {
    assert.deepEqual(parseUpdate(update('/start')), {
      chatId: 123456789,
      username: 'lea_m',
      command: 'start',
      argument: null,
    })
  })

  test('reconnaît /stop', ({ assert }) => {
    assert.equal(parseUpdate(update('/stop'))?.command, 'stop')
  })

  test('tolère un compte sans pseudo', ({ assert }) => {
    const raw = update('/start CODE')
    raw.message.from = { id: 1, is_bot: false, first_name: 'Léa' } as never
    assert.isNull(parseUpdate(raw)!.username)
  })

  test('ignore ce qui n’est pas une commande connue', ({ assert }) => {
    assert.isNull(parseUpdate(update('bonjour')))
    assert.isNull(parseUpdate(update('/aide')))
  })

  test('ignore un message édité, un groupe, et un update sans message', ({ assert }) => {
    assert.isNull(parseUpdate({ update_id: 1, edited_message: update('/start X').message }))
    assert.isNull(parseUpdate(update('/start X', { chat: { id: 5, type: 'group' } })))
    assert.isNull(parseUpdate({ update_id: 1 }))
    assert.isNull(parseUpdate(null))
  })
})

test.group('Charge utile Telegram — classement des échecs d’envoi', () => {
  /**
   * Un blocage n'est pas une panne : le distinguer est ce qui évite de retenter
   * indéfiniment un message que Telegram refusera toujours.
   */
  test('un blocage est définitif', ({ assert }) => {
    assert.equal(
      classifySendFailure(403, { description: 'Forbidden: bot was blocked by the user' }).kind,
      'permanent'
    )
    assert.equal(
      classifySendFailure(400, { description: 'Bad Request: chat not found' }).kind,
      'permanent'
    )
  })

  test('une limitation est temporaire et porte son délai', ({ assert }) => {
    const outcome = classifySendFailure(429, {
      description: 'Too Many Requests',
      parameters: { retry_after: 30 },
    })

    assert.equal(outcome.kind, 'transient')
    assert.equal(outcome.retryAfterSeconds, 30)
  })

  test('une panne serveur est temporaire', ({ assert }) => {
    assert.equal(classifySendFailure(502, {}).kind, 'transient')
  })

  /** Un texte vide ou trop long ne s'arrangera pas au prochain cron. */
  test('les autres refus sont définitifs', ({ assert }) => {
    assert.equal(
      classifySendFailure(400, { description: 'Bad Request: text is empty' }).kind,
      'permanent'
    )
  })
})
