import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
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
