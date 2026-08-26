import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import { asCoordinator } from '#tests/helpers/permissions'
import EventUnsettle from '../../commands/event_unsettle.js'

test.group('event:unsettle', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  async function pointsOf(memberId: number) {
    const member = await Member.findOrFail(memberId)
    return member.points
  }

  async function closedEvening() {
    const event = await EventFactory.create()
    const beforeJob = await JobFactory.merge({ type: 'before' }).create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const memberA = await MemberFactory.create()
    const memberB = await MemberFactory.create()
    const user = await asCoordinator(memberA)

    await MemberEventAssignedJob.create({
      memberId: memberA.id,
      eventId: event.id,
      jobId: beforeJob.id,
      locked: false,
      pointsDelta: 12,
    })
    await MemberEventAssignedJob.create({
      memberId: memberA.id,
      eventId: event.id,
      jobId: duringJob.id,
      locked: false,
      pointsDelta: -4,
    })
    await MemberEventAssignedJob.create({
      memberId: memberB.id,
      eventId: event.id,
      jobId: duringJob.id,
      locked: false,
      pointsDelta: 8,
    })

    return { event, memberA, memberB, user }
  }

  test('takes the consolidated deltas back out of members.points', async ({ client, assert }) => {
    const { event, memberA, memberB, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    assert.equal(await pointsOf(memberA.id), 8)
    assert.equal(await pointsOf(memberB.id), 8)

    const command = await ace.create(EventUnsettle, [String(event.id)])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(memberA.id), 0)
    assert.equal(await pointsOf(memberB.id), 0)
  })

  test('clears settled_at so the matching can be re-run', async ({ client, assert }) => {
    const { event, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const command = await ace.create(EventUnsettle, [String(event.id)])
    await command.exec()

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 3)
    for (const row of rows) {
      assert.isNull(row.settledAt)
    }

    const rerun = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    rerun.assertStatus(200)
  })

  /**
   * `settle` ferme la soirée en plus de consolider les points. Ne défaire que
   * la moitié « points » laisserait une soirée `completed` mais déconsolidée :
   * la caisse resterait inatteignable et la vue live vide, alors même que
   * l'opérateur vient de la rouvrir.
   */
  test('remet la soirée en service', async ({ client, assert }) => {
    await db.from('events').where('status', 'ongoing').update({ status: 'scheduled' })
    const { event, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    const afterSettle = await Event.findOrFail(event.id)
    assert.equal(afterSettle.status, 'completed')

    const command = await ace.create(EventUnsettle, [String(event.id)])
    await command.exec()
    command.assertSucceeded()

    const afterUnsettle = await Event.findOrFail(event.id)
    assert.equal(afterUnsettle.status, 'ongoing')
  })

  /** L'invariant « au plus une ouverte » vaut aussi pour la marche arrière. */
  test('retombe sur « scheduled » quand une autre soirée est déjà ouverte', async ({
    client,
    assert,
  }) => {
    await db.from('events').where('status', 'ongoing').update({ status: 'scheduled' })
    const { event, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    await EventFactory.merge({ name: 'Soirée en cours', status: 'ongoing' }).create()

    const command = await ace.create(EventUnsettle, [String(event.id)])
    await command.exec()
    command.assertSucceeded()

    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.status, 'scheduled')
  })

  test('writes nothing in dry-run', async ({ client, assert }) => {
    const { event, memberA, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const command = await ace.create(EventUnsettle, [String(event.id), '--dry-run'])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(memberA.id), 8)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    for (const row of rows) {
      assert.isNotNull(row.settledAt)
    }
  })

  test('is idempotent: a second run finds nothing left to undo', async ({ client, assert }) => {
    const { event, memberA, user } = await closedEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    for (let i = 0; i < 2; i++) {
      const command = await ace.create(EventUnsettle, [String(event.id)])
      await command.exec()
      command.assertSucceeded()
    }

    assert.equal(await pointsOf(memberA.id), 0)
  })

  test('fails on an unknown event rather than silently doing nothing', async ({ assert }) => {
    const command = await ace.create(EventUnsettle, ['999999'])
    await command.exec()

    command.assertFailed()
    assert.isTrue(true)
  })
})
