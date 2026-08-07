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
    // The evening must offer the job — `store` refuses an unoffered one since
    // a hand-made assignment carries real credit.
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

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
    // A hand-made assignment is scored exactly like the same automatic one
    // (§4.5): an unranked `during` job is worth CHARGE.during 8 − rankCost(null).
    assert.equal(row?.points_delta, 8)
  })

  test('defaults locked to false when omitted', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const created = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })
    created.assertBodyContains({ data: { locked: false } })
  })

  test('exposes settled_at as an ISO string, null when the row is not settled', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 4,
    })

    const pending = await client.get('/v1/assignments').loginAs(user)
    const pendingBody = pending.body() as {
      data: Array<{ member_id: number; settled_at: string | null }>
    }
    const pendingRow = pendingBody.data.find((r) => r.member_id === member.id)
    assert.isNull(pendingRow?.settled_at)

    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const settled = await client.get('/v1/assignments').loginAs(user)
    const settledBody = settled.body() as {
      data: Array<{ member_id: number; settled_at: string | null }>
    }
    const settledRow = settledBody.data.find((r) => r.member_id === member.id)
    assert.isString(settledRow?.settled_at)
    assert.isNotNull(settledRow?.settled_at)
  })
})

/**
 * Structural rules of a hand-made assignment.
 *
 * `store` used to accept anything: a job the evening does not even offer, a job
 * the member is barred from, a second job on a period they already cover. That
 * was harmless while `points_delta` was always 0 — since §4.5 every accepted
 * row is worth up to +12, so an unprivileged member could mint credit at will.
 */
test.group('Assignments structural rules', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function scene() {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    return { member, user, event }
  }

  async function offer(event: Awaited<ReturnType<typeof EventFactory.create>>, jobId: number) {
    await event.related('jobs').sync({ [jobId]: { count: 2 } }, false)
  }

  test('refuses a job the evening does not offer', async ({ client, assert }) => {
    const { member, user, event } = await scene()
    const job = await JobFactory.merge({ type: 'before' }).create()

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_JOB_NOT_OFFERED' } })

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 0)
  })

  test('refuses a member barred from a restricted job', async ({ client, assert }) => {
    const { member, user, event } = await scene()
    const job = await JobFactory.merge({ type: 'before' }).create()
    await offer(event, job.id)
    const allowed = await MemberFactory.create()
    await job.related('eligibleMembers').sync({ [allowed.id]: {} }, false)

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_MEMBER_NOT_ELIGIBLE' } })

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 0)
  })

  test('leaves a job with no eligibility rows open to everyone', async ({ client }) => {
    const { member, user, event } = await scene()
    const job = await JobFactory.merge({ type: 'before' }).create()
    await offer(event, job.id)

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(200)
  })

  test('refuses a second job on a period the member already covers', async ({ client, assert }) => {
    const { member, user, event } = await scene()
    const held = await JobFactory.merge({ type: 'during' }).create()
    const other = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [held.id]: { count: 1 }, [other.id]: { count: 1 } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: held.id,
      locked: false,
      pointsDelta: 8,
    })

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: other.id })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_PERIOD_ALREADY_ASSIGNED' } })

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
  })

  test('accepts a second job on another period of the same evening', async ({ client, assert }) => {
    const { member, user, event } = await scene()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const afterJob = await JobFactory.merge({ type: 'after' }).create()
    await event
      .related('jobs')
      .sync({ [duringJob.id]: { count: 1 }, [afterJob.id]: { count: 1 } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: duringJob.id,
      locked: false,
      pointsDelta: 8,
    })

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: afterJob.id })

    response.assertStatus(200)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 2)
  })

  /**
   * The reported abuse, end to end: five jobs the evening does not offer, each
   * accepted at +12, then a close carrying the member to 60 points.
   */
  test('cannot mint credit out of jobs the evening never offered', async ({ client, assert }) => {
    const { member, user, event } = await scene()

    for (let i = 0; i < 5; i++) {
      const job = await JobFactory.merge({ type: 'before' }).create()
      const response = await client
        .post('/v1/assignments')
        .loginAs(user)
        .json({ member_id: member.id, event_id: event.id, job_id: job.id })
      response.assertStatus(422)
    }

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 0)
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

  /**
   * The composite key again. `assignment.save()` keys the UPDATE on the model's
   * primary column alone, and the generated schema only marks `member_id` as
   * primary — so locking one row used to lock every row of that member.
   *
   * A row locked by accident then escapes the `.where('locked', false).delete()`
   * of a matching re-run: the engine can no longer replace it, and its capacity
   * stays reserved for good.
   */
  test('locks only the targeted row, leaving the member other job of the evening open', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const afterJob = await JobFactory.merge({ type: 'after' }).create()

    for (const job of [duringJob, afterJob]) {
      await MemberEventAssignedJob.create({
        memberId: member.id,
        eventId: event.id,
        jobId: job.id,
        locked: false,
        pointsDelta: 0,
      })
    }

    const response = await client
      .put('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: duringJob.id })
      .loginAs(user)
      .json({ locked: true })

    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query()
      .where('memberId', member.id)
      .where('eventId', event.id)
    const lockedByJob = new Map(rows.map((row) => [row.jobId, row.locked]))
    assert.isTrue(lockedByJob.get(duringJob.id))
    assert.isFalse(lockedByJob.get(afterJob.id))
  })

  test('does not leak the lock onto the member assignment of another evening', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const otherEvent = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()

    for (const target of [event, otherEvent]) {
      await MemberEventAssignedJob.create({
        memberId: member.id,
        eventId: target.id,
        jobId: job.id,
        locked: false,
        pointsDelta: 0,
      })
    }

    await client
      .put('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)
      .json({ locked: true })

    const untouched = await MemberEventAssignedJob.query()
      .where('memberId', member.id)
      .where('eventId', otherEvent.id)
      .where('jobId', job.id)
      .firstOrFail()
    assert.isFalse(untouched.locked)
  })
})
