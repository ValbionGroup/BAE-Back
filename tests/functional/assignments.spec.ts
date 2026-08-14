import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import MemberEventAssignedJob from '#models/member_event_assigned_job'

test.group('Assignments locking', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('stores and exposes the locked flag on a created assignment', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    const created = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id, locked: true })
    created.assertStatus(200)
    created.assertBodyContains({ data: { locked: true } })

    const index = await client.get('/v1/assignments').loginAs(user)
    const body = index.body() as {
      data: Array<{ member_id: number; locked: boolean; points_delta: number }>
    }
    const row = body.data.find((r) => r.member_id === member.id)
    assert.equal(row?.locked, true)
    assert.equal(row?.points_delta, 0)
  })

  test('defaults locked to false when omitted', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    const created = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })
    created.assertBodyContains({ data: { locked: false } })
  })
})

test.group('Assignments update', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seedAssignment(pointsDelta = 0) {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    const assignment = await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta,
    })
    return { user, assignment }
  }

  function key(assignment: MemberEventAssignedJob) {
    return {
      member_id: assignment.memberId,
      event_id: assignment.eventId,
      job_id: assignment.jobId,
    }
  }

  test('toggles the lock in place', async ({ client, assert }) => {
    const { user, assignment } = await seedAssignment()

    const response = await client
      .put('/v1/assignments')
      .qs(key(assignment))
      .loginAs(user)
      .json({ locked: true })

    response.assertStatus(200)
    response.assertBodyContains({ data: { locked: true } })

    await assignment.refresh()
    assert.isTrue(assignment.locked)
  })

  /**
   * The reason this route exists. Locking used to be a DELETE followed by a
   * POST, which dropped `points_delta` back to 0 — the very value the matching
   * engine refunds when it replaces a row, so losing it corrupted point totals
   * on the next run.
   */
  test('preserves points_delta, unlike the delete-then-recreate it replaces', async ({
    client,
    assert,
  }) => {
    const { user, assignment } = await seedAssignment(8)

    const response = await client
      .put('/v1/assignments')
      .qs(key(assignment))
      .loginAs(user)
      .json({ locked: true })

    response.assertStatus(200)
    response.assertBodyContains({ data: { locked: true, points_delta: 8 } })

    await assignment.refresh()
    assert.equal(assignment.pointsDelta, 8)
  })

  test('unlocks again', async ({ client, assert }) => {
    const { user, assignment } = await seedAssignment()
    await client.put('/v1/assignments').qs(key(assignment)).loginAs(user).json({ locked: true })

    await client.put('/v1/assignments').qs(key(assignment)).loginAs(user).json({ locked: false })

    await assignment.refresh()
    assert.isFalse(assignment.locked)
  })

  test('creates nothing when the assignment does not exist', async ({ client, assert }) => {
    const { user, assignment } = await seedAssignment()

    const response = await client
      .put('/v1/assignments')
      .qs({ ...key(assignment), job_id: assignment.jobId + 9999 })
      .loginAs(user)
      .json({ locked: true })

    response.assertStatus(404)
    const rows = await MemberEventAssignedJob.query().where('eventId', assignment.eventId)
    assert.lengthOf(rows, 1)
  })

  test('rejects a body without the locked flag', async ({ client }) => {
    const { user, assignment } = await seedAssignment()

    const response = await client.put('/v1/assignments').qs(key(assignment)).loginAs(user).json({})

    response.assertStatus(422)
  })
})
