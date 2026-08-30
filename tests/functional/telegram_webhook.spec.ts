import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import TelegramLinkCode from '#models/telegram_link_code'
import { UserFactory } from '#database/factories/user_factory'
import TelegramClient from '#services/telegram/telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'
import { issueLinkCode } from '#services/telegram/telegram_link_service'
import telegramConfig from '#config/telegram'

const CHAT_ID = 123456789

/** Un update tel que Telegram l'envoie sur le fil : **snake_case**. */
function startUpdate(code: string, chatId = CHAT_ID) {
  return {
    update_id: 42,
    message: {
      message_id: 7,
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, is_bot: false, first_name: 'Léa', username: 'lea_m' },
      text: `/start ${code}`,
    },
  }
}

async function aClient() {
  const user = await UserFactory.create()
  const client = await Client.create({ id: user.id, registeredAt: DateTime.now() })
  return { user, client }
}

test.group('Webhook Telegram', (group) => {
  let telegram: FakeTelegramClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    telegram = new FakeTelegramClient()
    app.container.swap(TelegramClient, () => telegram)
    return () => app.container.restore(TelegramClient)
  })

  test('refuse un appel sans secret, et ne lie rien', async ({ client, assert }) => {
    const { user, client: row } = await aClient()
    const { code } = await issueLinkCode(user.id)

    const response = await client.post('/v1/telegram/webhook').json(startUpdate(code))

    response.assertStatus(403)
    await row.refresh()
    assert.isNull(row.telegramChatId)
  })

  test('refuse un mauvais secret', async ({ client }) => {
    const response = await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', 'pas-le-bon')
      .json(startUpdate('PEU-IMPORTE'))

    response.assertStatus(403)
  })

  /**
   * ⚠️ **La non-régression centrale.** `case_converter_middleware` camélifie le
   * corps de toutes les routes : lu par `request.body()`, cet update arriverait en
   * `updateId` / `messageId` et ne serait plus reconnu — sans la moindre erreur.
   */
  test('lie le compte à partir d’un corps snake_case', async ({ client, assert }) => {
    const { user, client: row } = await aClient()
    const { code } = await issueLinkCode(user.id)

    const response = await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate(code))

    response.assertStatus(204)
    await row.refresh()
    assert.equal(String(row.telegramChatId), String(CHAT_ID))
    assert.equal(row.telegramHandle, 'lea_m')
    assert.include(telegram.sent[0]?.text, 'C’est fait')
  })

  test('le code est consommé : le même lien rejoué ne relie pas deux fois', async ({
    client,
    assert,
  }) => {
    const { user } = await aClient()
    const { code } = await issueLinkCode(user.id)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await client
        .post('/v1/telegram/webhook')
        .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
        .json(startUpdate(code))
    }

    const rows = await TelegramLinkCode.query().where('userId', user.id)
    assert.lengthOf(rows, 1)
    assert.isNotNull(rows[0].usedAt)
    assert.include(telegram.sent[1]?.text, 'déjà lié')
  })

  test('un code inconnu ne lie rien et le dit', async ({ client, assert }) => {
    const { client: row } = await aClient()

    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate('ZZZZZZZZZZZZ'))

    await row.refresh()
    assert.isNull(row.telegramChatId)
    assert.include(telegram.sent[0]?.text, 'n’est pas valide')
  })

  test('un code expiré est refusé sans être consommé', async ({ client, assert }) => {
    const { user } = await aClient()
    const { code } = await issueLinkCode(user.id)
    await TelegramLinkCode.query()
      .where('userId', user.id)
      .update({ expires_at: DateTime.now().minus({ hours: 1 }).toSQL() })

    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate(code))

    const row = await TelegramLinkCode.findByOrFail('userId', user.id)
    assert.isNull(row.usedAt)
    assert.include(telegram.sent[0]?.text, 'expiré')
  })

  /**
   * `telegram_chat_id` est unique. Le second doit être refusé **sans** consommer
   * son code : il pourra recliquer le même lien après avoir délié l'autre profil.
   */
  test('un chat déjà lié à un autre profil est refusé, code intact', async ({ client, assert }) => {
    const first = await aClient()
    const second = await aClient()

    const firstCode = await issueLinkCode(first.user.id)
    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate(firstCode.code))

    const secondCode = await issueLinkCode(second.user.id)
    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate(secondCode.code))

    await first.client.refresh()
    await second.client.refresh()
    assert.equal(String(first.client.telegramChatId), String(CHAT_ID))
    assert.isNull(second.client.telegramChatId)

    const row = await TelegramLinkCode.findByOrFail('userId', second.user.id)
    assert.isNull(row.usedAt)
    assert.include(telegram.sent[1]?.text, 'déjà lié à un autre profil')
  })

  test('/stop délie depuis Telegram', async ({ client, assert }) => {
    const { user, client: row } = await aClient()
    const { code } = await issueLinkCode(user.id)
    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(startUpdate(code))

    const stop = startUpdate('')
    stop.message.text = '/stop'
    await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json(stop)

    await row.refresh()
    assert.isNull(row.telegramChatId)
    assert.include(telegram.sent[1]?.text, 'délié')
  })

  test('un message édité ne déclenche rien', async ({ client, assert }) => {
    const response = await client
      .post('/v1/telegram/webhook')
      .header('x-telegram-bot-api-secret-token', telegramConfig.webhookSecret)
      .json({ update_id: 1, edited_message: startUpdate('X').message })

    response.assertStatus(204)
    assert.lengthOf(telegram.sent, 0)
  })
})
