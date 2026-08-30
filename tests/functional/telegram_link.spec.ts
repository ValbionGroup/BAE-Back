import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import TelegramLinkCode from '#models/telegram_link_code'
import { UserFactory } from '#database/factories/user_factory'
import { MemberFactory } from '#database/factories/members_factory'
import TelegramClient from '#services/telegram/telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'

async function aClient(attrs: Partial<{ telegramChatId: number | null }> = {}) {
  const user = await UserFactory.create()
  const client = await Client.create({
    id: user.id,
    registeredAt: DateTime.now(),
    telegramHandle: 'lea_m',
    telegramChatId: attrs.telegramChatId ?? null,
  })
  return { user, client }
}

test.group('Liaison Telegram — endpoints', (group) => {
  let telegram: FakeTelegramClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    telegram = new FakeTelegramClient()
    app.container.swap(TelegramClient, () => telegram)
    return () => app.container.restore(TelegramClient)
  })

  test('sans session, la route refuse', async ({ client }) => {
    const response = await client.post('/v1/account/telegram/link')

    response.assertStatus(401)
  })

  test('un membre sans ligne client ne peut pas demander de lien', async ({ client }) => {
    const member = await MemberFactory.create()

    const response = await client.post('/v1/account/telegram/link').loginAs(member.user)

    response.assertStatus(403)
  })

  /** Le deep-link plafonne à 64 caractères dans `[A-Za-z0-9_-]`. */
  test('le lien porte un code court et sans caractère à échapper', async ({ client, assert }) => {
    const { user } = await aClient()

    const response = await client.post('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
    const body = response.body().data as { url: string; code: string; bot_username: string }
    assert.isAtMost(body.code.length, 64)
    assert.match(body.code, /^[A-Za-z0-9_-]+$/)
    assert.equal(body.url, `https://t.me/${body.bot_username}?start=${body.code}`)
  })

  test('redemander un lien périme le précédent', async ({ client, assert }) => {
    const { user } = await aClient()

    await client.post('/v1/account/telegram/link').loginAs(user)
    await client.post('/v1/account/telegram/link').loginAs(user)

    const rows = await TelegramLinkCode.query().where('userId', user.id).orderBy('id', 'asc')
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].usedAt)
    assert.isNull(rows[1].usedAt)
  })

  /** Relier suppose de délier d'abord : un état « en cours de déménagement » n'existe pas. */
  test('un compte déjà lié doit délier avant de relier', async ({ client }) => {
    const { user } = await aClient({ telegramChatId: 999 })

    const response = await client.post('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(409)
  })

  test('délier efface le chat mais garde le pseudo', async ({ client, assert }) => {
    const { user, client: row } = await aClient({ telegramChatId: 999 })

    const response = await client.delete('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
    await row.refresh()
    assert.isNull(row.telegramChatId)
    assert.isNull(row.telegramLinkedAt)
    assert.equal(row.telegramHandle, 'lea_m')
    assert.deepEqual(telegram.sent[0]?.chatId, 999)
  })

  test('délier un compte non lié ne casse rien', async ({ client }) => {
    const { user } = await aClient()

    const response = await client.delete('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
  })
})
