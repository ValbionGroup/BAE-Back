import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import ActivityEvent from '#models/activity_event'
import Notification from '#models/notification'
import { MemberFactory } from '#database/factories/members_factory'

test.group('Notifications — schéma', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('une même livraison ne peut pas être insérée deux fois', async ({ assert }) => {
    const member = await MemberFactory.create()
    const event = await ActivityEvent.create({
      actorId: null,
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 1,
      payload: { eventName: 'Soirée test' },
      occurredAt: DateTime.now(),
    })

    await Notification.create({ eventId: event.id, userId: member.id, channel: 'mail' })

    await assert.rejects(() =>
      Notification.create({ eventId: event.id, userId: member.id, channel: 'mail' })
    )
  })

  test('le même fait peut partir sur deux canaux distincts', async ({ assert }) => {
    const member = await MemberFactory.create()
    const event = await ActivityEvent.create({
      actorId: null,
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 1,
      payload: {},
      occurredAt: DateTime.now(),
    })

    await Notification.create({ eventId: event.id, userId: member.id, channel: 'mail' })
    const second = await Notification.create({
      eventId: event.id,
      userId: member.id,
      channel: 'in_app',
    })

    assert.isNumber(second.id)
  })

  test('payload survit à l’aller-retour en base', async ({ assert }) => {
    const created = await ActivityEvent.create({
      actorId: null,
      verb: 'presence.upcoming',
      subjectType: 'event',
      subjectId: 42,
      payload: { eventName: 'Gala', when: '2026-09-01' },
      occurredAt: DateTime.now(),
    })

    const reloaded = await ActivityEvent.findOrFail(created.id)
    assert.deepEqual(reloaded.payload, { eventName: 'Gala', when: '2026-09-01' })
  })
})
