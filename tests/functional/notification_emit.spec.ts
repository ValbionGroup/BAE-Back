import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import { emit } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'

test.group('emit — atomique et idempotent', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('crée un fait et une livraison par destinataire', async ({ assert }) => {
    const a = await MemberFactory.create()
    const b = await MemberFactory.create()

    const result = await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 7,
      payload: { eventName: 'Soirée' },
      recipients: [a.id, b.id],
    })

    assert.equal(result.created, 2)
    assert.equal(result.skipped, 0)

    const rows = await Notification.query().where('eventId', result.eventId)
    assert.lengthOf(rows, 2)
    assert.isNull(rows[0].sentAt, 'une livraison naît en file d’attente')
  })

  test('un doublon est compté, pas levé', async ({ assert }) => {
    const a = await MemberFactory.create()

    const result = await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 7,
      recipients: [a.id, a.id],
    })

    assert.equal(result.created, 1)
    assert.equal(result.skipped, 1, 'le second exemplaire est ignoré, pas une erreur')
  })

  test('deux emits du même fait pour la même personne ne livrent qu’une fois', async ({
    assert,
  }) => {
    const a = await MemberFactory.create()
    const input = {
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 99,
      recipients: [a.id],
      dedupeKey: 'presence.pending:99',
    }

    await emit(input)
    const second = await emit(input)

    assert.equal(second.created, 0, 'le second passage ne crée rien')
    assert.equal(second.skipped, 1)
  })
})

test.group('emit — canal Telegram', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function linkedMember(chatId: number) {
    const member = await MemberFactory.create()
    member.user.telegramChatId = chatId
    member.user.telegramLinkedAt = DateTime.now()
    await member.user.save()
    return member
  }

  const channelsOf = async (eventId: number) => {
    const rows = await Notification.query().where('eventId', eventId)
    return rows.map((row) => row.channel).sort()
  }

  test('un destinataire lié reçoit Telegram en plus du mail', async ({ assert }) => {
    const member = await linkedMember(111)

    const result = await emit({
      verb: 'ticket.updated',
      subjectType: 'ticket',
      subjectId: 1,
      recipients: [member.id],
      channels: ['in_app', 'mail'],
    })

    assert.deepEqual(await channelsOf(result.eventId), ['in_app', 'mail', 'telegram'])
  })

  test('un destinataire non lié n’en reçoit pas', async ({ assert }) => {
    const member = await MemberFactory.create()

    const result = await emit({
      verb: 'ticket.updated',
      subjectType: 'ticket',
      subjectId: 1,
      recipients: [member.id],
      channels: ['mail'],
    })

    assert.deepEqual(await channelsOf(result.eventId), ['mail'])
  })

  /**
   * `in_app` est un canal d'interface : le rejouer dans Telegram transformerait
   * chaque trace du fil d'activité en notification poussée.
   */
  test('un envoi purement in_app ne part pas dans Telegram', async ({ assert }) => {
    const member = await linkedMember(222)

    const result = await emit({
      verb: 'ticket.opened',
      subjectType: 'ticket',
      subjectId: 1,
      recipients: [member.id],
      channels: ['in_app'],
    })

    assert.deepEqual(await channelsOf(result.eventId), ['in_app'])
  })

  test('réémettre ne duplique pas la livraison Telegram', async ({ assert }) => {
    const member = await linkedMember(333)
    const fact = {
      verb: 'ticket.updated',
      subjectType: 'ticket',
      subjectId: 1,
      recipients: [member.id],
      channels: ['mail'] as const,
    }

    const first = await emit(fact)
    await emit(fact)

    const rows = await Notification.query().where('eventId', first.eventId)
    assert.lengthOf(rows, 2)
  })
})
