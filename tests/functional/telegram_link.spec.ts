import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import TelegramLinkCode from '#models/telegram_link_code'
import { UserFactory } from '#database/factories/user_factory'
import { MemberFactory } from '#database/factories/members_factory'
import TelegramClient from '#services/telegram/telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'

/** La liaison vit sur `users` : aucune ligne `clients` n'est nécessaire pour la porter. */
async function aLinkableUser(attrs: Partial<{ telegramChatId: number | null }> = {}) {
  const user = await UserFactory.create()
  user.telegramHandle = 'lea_m'
  user.telegramChatId = attrs.telegramChatId ?? null
  user.telegramLinkedAt = user.telegramChatId === null ? null : DateTime.now()
  await user.save()
  return user
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

  /**
   * Le défaut visé : la liaison vivait sur `clients`, ce qui la réservait à ceux
   * qui n'en ont pas besoin. La plupart des notifications s'adressent au bureau.
   */
  test('un membre du bureau sans ligne client peut demander un lien', async ({ client }) => {
    const member = await MemberFactory.create()

    const response = await client.post('/v1/account/telegram/link').loginAs(member.user)

    response.assertStatus(200)
  })

  /** Le deep-link plafonne à 64 caractères dans `[A-Za-z0-9_-]`. */
  test('le lien porte un code court et sans caractère à échapper', async ({ client, assert }) => {
    const user = await aLinkableUser()

    const response = await client.post('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
    const body = response.body().data as { url: string; code: string; bot_username: string }
    assert.isAtMost(body.code.length, 64)
    assert.match(body.code, /^[A-Za-z0-9_-]+$/)
    assert.equal(body.url, `https://t.me/${body.bot_username}?start=${body.code}`)
  })

  test('redemander un lien périme le précédent', async ({ client, assert }) => {
    const user = await aLinkableUser()

    await client.post('/v1/account/telegram/link').loginAs(user)
    await client.post('/v1/account/telegram/link').loginAs(user)

    const rows = await TelegramLinkCode.query().where('userId', user.id).orderBy('id', 'asc')
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].usedAt)
    assert.isNull(rows[1].usedAt)
  })

  /** Relier suppose de délier d'abord : un état « en cours de déménagement » n'existe pas. */
  test('un compte déjà lié doit délier avant de relier', async ({ client }) => {
    const user = await aLinkableUser({ telegramChatId: 999 })

    const response = await client.post('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(409)
  })

  test('délier efface le chat mais garde le pseudo', async ({ client, assert }) => {
    const user = await aLinkableUser({ telegramChatId: 999 })

    const response = await client.delete('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, { handle: 'lea_m', linked: false, linked_at: null })
    await user.refresh()
    assert.isNull(user.telegramChatId)
    assert.isNull(user.telegramLinkedAt)
    assert.equal(user.telegramHandle, 'lea_m')
    assert.deepEqual(telegram.sent[0]?.chatId, 999)
  })

  test('délier un compte non lié ne casse rien', async ({ client }) => {
    const user = await aLinkableUser()

    const response = await client.delete('/v1/account/telegram/link').loginAs(user)

    response.assertStatus(200)
  })
})
