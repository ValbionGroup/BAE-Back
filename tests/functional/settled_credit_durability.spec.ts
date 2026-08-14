import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import { asCoordinator } from '#tests/helpers/permissions'
import EventUnsettle from '../../commands/event_unsettle.js'
import PointsRecompute from '../../commands/points_recompute.js'

/**
 * `points:recompute` rebuilds `members.points` as the sum of the SETTLED
 * `points_delta`. That derivation is only sound while a settled row cannot
 * vanish — and the FKs of `member_event_assigned_jobs` used to be
 * `onDelete('CASCADE')`, so deleting an evening or a job erased the rows
 * without touching `members.points`.
 *
 * The reported sequence: +12 settled → `points = 12` → `DELETE /v1/events/E` →
 * `points = 12` → `points:recompute` → **`points = 0`**. The safety net was
 * the tool that wiped the credit.
 *
 * The fix keeps the settled ledger: a consolidated row is not deletable, so the
 * sum the command derives always has its source in front of it.
 */
test.group('Settled credit durability', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  async function pointsOf(memberId: number) {
    const member = await Member.findOrFail(memberId)
    return member.points
  }

  async function settledEvening(delta = 12) {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'before' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    const member = await MemberFactory.create()
    const user = await asCoordinator(member)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: delta,
    })
    return { event, job, member, user }
  }

  test('refuses to delete an evening whose points were consolidated', async ({
    client,
    assert,
  }) => {
    const { event, member, user } = await settledEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    assert.equal(await pointsOf(member.id), 12)

    const response = await client.delete(`/v1/events/${event.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_SETTLED' } })
    assert.equal(await pointsOf(member.id), 12)
  })

  /** The reported scenario, end to end. */
  test('points:recompute keeps the credit of a settled evening someone tried to delete', async ({
    client,
    assert,
  }) => {
    const { event, member, user } = await settledEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    assert.equal(await pointsOf(member.id), 12)

    await client.delete(`/v1/events/${event.id}`).loginAs(user)
    assert.equal(await pointsOf(member.id), 12)

    const command = await ace.create(PointsRecompute, [])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(member.id), 12)
  })

  test('refuses to delete a job still carrying a consolidated assignment', async ({
    client,
    assert,
  }) => {
    const { event, job, member, user } = await settledEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const response = await client.delete(`/v1/jobs/${job.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_JOB_SETTLED' } })
    assert.equal(await pointsOf(member.id), 12)
  })

  test('still deletes an evening whose assignments were never consolidated', async ({
    client,
    assert,
  }) => {
    const { event, member, user } = await settledEvening()

    const response = await client.delete(`/v1/events/${event.id}`).loginAs(user)

    response.assertStatus(200)
    const rows = await MemberEventAssignedJob.query().where('memberId', member.id)
    assert.lengthOf(rows, 0)
    assert.equal(await pointsOf(member.id), 0)
  })

  test('still deletes a job whose assignments were never consolidated', async ({
    client,
    assert,
  }) => {
    const { job, member, user } = await settledEvening()

    const response = await client.delete(`/v1/jobs/${job.id}`).loginAs(user)

    response.assertStatus(204)
    const rows = await MemberEventAssignedJob.query().where('memberId', member.id)
    assert.lengthOf(rows, 0)
  })

  /** The way out: un-settle first, then delete — the credit is given back
   *  explicitly instead of evaporating. */
  test('lets the evening be deleted once event:unsettle has given the credit back', async ({
    client,
    assert,
  }) => {
    const { event, member, user } = await settledEvening()
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const command = await ace.create(EventUnsettle, [String(event.id)])
    await command.exec()
    command.assertSucceeded()
    assert.equal(await pointsOf(member.id), 0)

    const response = await client.delete(`/v1/events/${event.id}`).loginAs(user)

    response.assertStatus(200)
    assert.equal(await pointsOf(member.id), 0)
  })
})
