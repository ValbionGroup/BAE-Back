import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import Notification from '#models/notification'
import db from '@adonisjs/lucid/services/db'
import { emit } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import TelegramClient from '#services/telegram/telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'
import TelegramDispatch from '../../commands/telegram_dispatch.js'

const CHAT_ID = 555

test.group('telegram:dispatch', (group) => {
  let telegram: FakeTelegramClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })
  group.each.setup(() => {
    telegram = new FakeTelegramClient()
    app.container.swap(TelegramClient, () => telegram)
    return () => app.container.restore(TelegramClient)
  })

  async function linkedMember(chatId = CHAT_ID) {
    const member = await MemberFactory.create()
    member.user.telegramChatId = chatId
    member.user.telegramLinkedAt = DateTime.now()
    await member.user.save()
    return member
  }

  async function aNotification(memberId: number) {
    return emit({
      verb: 'ticket.updated',
      subjectType: 'ticket',
      subjectId: 1,
      payload: { subject: 'Ticket mis à jour', lines: ['« Panne de tireuse » est passé en clos.'] },
      recipients: [memberId],
      channels: ['mail'],
    })
  }

  const run = async (args: string[] = []) => {
    const command = await ace.create(TelegramDispatch, args)
    await command.exec()
    command.assertSucceeded()
  }

  test('envoie la livraison Telegram et l’horodate', async ({ assert }) => {
    const member = await linkedMember()
    const result = await aNotification(member.id)

    await run()

    assert.lengthOf(telegram.sent, 1)
    assert.equal(telegram.sent[0].chatId, CHAT_ID)
    assert.include(telegram.sent[0].text, 'Ticket mis à jour')
    assert.include(telegram.sent[0].text, 'Panne de tireuse')

    const row = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'telegram')
      .firstOrFail()
    assert.isNotNull(row.sentAt)
  })

  /** La passe mail a sa propre commande : celle-ci ne doit pas y toucher. */
  test('ne touche pas aux livraisons mail', async ({ assert }) => {
    const member = await linkedMember()
    const result = await aNotification(member.id)

    await run()

    const mailRow = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'mail')
      .firstOrFail()
    assert.isNull(mailRow.sentAt)
  })

  test('ne renvoie pas une livraison déjà horodatée', async ({ assert }) => {
    const member = await linkedMember()
    await aNotification(member.id)

    await run()
    await run()

    assert.lengthOf(telegram.sent, 1)
  })

  /**
   * Bloquer le bot **est** une déliaison, exprimée dans le seul canal dont
   * l'utilisateur dispose. Sans ça, la file retenterait le message pour toujours.
   */
  test('un blocage délie le compte et draine la ligne', async ({ assert }) => {
    const member = await linkedMember()
    const result = await aNotification(member.id)
    telegram.nextSendOutcome = {
      ok: false,
      kind: 'permanent',
      status: 403,
      description: 'Forbidden: bot was blocked by the user',
      retryAfterSeconds: null,
    }

    await run()

    await member.user.refresh()
    assert.isNull(member.user.telegramChatId)

    const row = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'telegram')
      .firstOrFail()
    assert.isNotNull(row.sentAt, 'la ligne est drainée, sinon le cron la retenterait sans fin')
  })

  test('une limitation laisse la ligne en file', async ({ assert }) => {
    const member = await linkedMember()
    const result = await aNotification(member.id)
    telegram.nextSendOutcome = {
      ok: false,
      kind: 'transient',
      status: 429,
      description: 'Too Many Requests',
      retryAfterSeconds: 30,
    }

    await run()

    const row = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'telegram')
      .firstOrFail()
    assert.isNull(row.sentAt)

    await member.user.refresh()
    assert.isNotNull(member.user.telegramChatId, 'une limitation ne délie personne')
  })

  test('--dry-run n’envoie rien et n’écrit rien', async ({ assert }) => {
    const member = await linkedMember()
    const result = await aNotification(member.id)

    await run(['--dry-run'])

    assert.lengthOf(telegram.sent, 0)
    const row = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'telegram')
      .firstOrFail()
    assert.isNull(row.sentAt)
  })

  test('le message Telegram porte le poste du membre', async ({ assert }) => {
    const member = await linkedMember()
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 1 }),
      status: 'scheduled',
    }).create()
    const job = await JobFactory.merge({ name: 'Plancha', type: 'during' }).create()

    await db.table('member_event_assigned_jobs').insert([
      { member_id: member.id, event_id: event.id, job_id: job.id, locked: false, points_delta: 0 },
    ])

    await emit({
      verb: 'presence.tomorrow',
      subjectType: 'event',
      subjectId: event.id,
      payload: { subject: "C'est demain", lines: [`${event.name}. Voici ton poste.`] },
      recipients: [member.id],
      channels: ['mail'],
      dedupeKey: `presence.tomorrow:${event.id}`,
    })

    await run()

    const mine = telegram.sent.find((m) => m.chatId === CHAT_ID)
    assert.exists(mine, 'un message est parti au chat lié')
    assert.include(mine!.text, 'Ton poste : Plancha — Pendant · Service')
  })
})
