import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import { MemberEventAssignedJobFactory } from '#database/factories/member_event_assigned_job_factory'

async function makeAvailable(member: Member, eventId: number) {
  await member.related('responses').sync({ [eventId]: { is_available: true } }, false)
}

async function setPreference(member: Member, jobId: number, rank: number) {
  await member.related('preferences').sync({ [jobId]: { rank } }, false)
}

test.group('Event matching', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sources the job-side ranking key from real attendance history, not raw points alone', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    // A: more raw points, but 5 prior events worked -> ranking key 20/5 = 4.
    const memberA = await MemberFactory.create()
    memberA.points = 20
    await memberA.save()
    for (let i = 0; i < 5; i++) {
      const pastEvent = await EventFactory.create()
      const pastJob = await JobFactory.create()
      await MemberEventAssignedJobFactory.merge({
        memberId: memberA.id,
        eventId: pastEvent.id,
        jobId: pastJob.id,
      }).create()
    }

    // B: fewer raw points, no prior history -> ranking key 10/1 = 10, outranks A.
    const memberB = await MemberFactory.create()
    memberB.points = 10
    await memberB.save()

    await makeAvailable(memberA, event.id)
    await makeAvailable(memberB, event.id)
    await setPreference(memberA, job.id, 1)
    await setPreference(memberB, job.id, 1)

    const user = await User.findOrFail(memberA.id)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].memberId, memberB.id)
  })

  test('clamps points at 100 and stores the applied (post-clamp) delta, not the raw formula output', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    member.points = 98
    await member.save()
    await makeAvailable(member, event.id)
    await setPreference(member, job.id, 1)

    const user = await User.findOrFail(member.id)
    await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    const row = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
      .firstOrFail()
    assert.equal(row.pointsDelta, 2)

    const updated = await Member.findOrFail(member.id)
    assert.equal(updated.points, 100)
  })

  test('leaves an unmatched available member with no assignment row and unchanged points', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const offeredJob = await JobFactory.create()
    const unofferedJob = await JobFactory.create()
    await event.related('jobs').sync({ [offeredJob.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    member.points = 40
    await member.save()
    await makeAvailable(member, event.id)
    // Only preference is for a job not offered at this event.
    await setPreference(member, unofferedJob.id, 1)

    const user = await User.findOrFail(member.id)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
    assert.lengthOf(rows, 0)

    const updated = await Member.findOrFail(member.id)
    assert.equal(updated.points, 40)
  })

  test('respects a manual lock: excludes it from the pool, reserves its capacity, never scores or touches it', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const lockedMember = await MemberFactory.create()
    lockedMember.points = 30
    await lockedMember.save()
    const lockedUser = await User.findOrFail(lockedMember.id)
    await client
      .post('/v1/assignments')
      .loginAs(lockedUser)
      .json({ member_id: lockedMember.id, event_id: event.id, job_id: job.id, locked: true })

    const contender = await MemberFactory.create()
    contender.points = 90
    await contender.save()
    await makeAvailable(contender, event.id)
    await setPreference(contender, job.id, 1)

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(lockedUser)
    response.assertStatus(200)

    const contenderRows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', contender.id)
    assert.lengthOf(contenderRows, 0)

    const lockedRow = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', lockedMember.id)
      .firstOrFail()
    assert.isTrue(lockedRow.locked)
    assert.equal(lockedRow.pointsDelta, 0)

    const refreshedLockedMember = await Member.findOrFail(lockedMember.id)
    assert.equal(refreshedLockedMember.points, 30)
  })

  test('excludes an ineligible member from a restricted job even when it is their top preference', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    // Lower points than the ineligible member, so the eligible member can only
    // win the single slot if the ineligible (higher-ranked) member is
    // filtered out before the algorithm runs — proving the restriction
    // actually excludes, rather than merely a coincidental no-op.
    const eligibleMember = await MemberFactory.create()
    eligibleMember.points = 10
    await eligibleMember.save()
    await job.related('eligibleMembers').sync({ [eligibleMember.id]: {} }, false)
    await makeAvailable(eligibleMember, event.id)
    await setPreference(eligibleMember, job.id, 1)

    const ineligibleMember = await MemberFactory.create()
    ineligibleMember.points = 100
    await ineligibleMember.save()
    await makeAvailable(ineligibleMember, event.id)
    await setPreference(ineligibleMember, job.id, 1)

    const user = await User.findOrFail(ineligibleMember.id)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const ineligibleRows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', ineligibleMember.id)
    assert.lengthOf(ineligibleRows, 0)

    const eligibleRow = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', eligibleMember.id)
      .firstOrFail()
    assert.equal(eligibleRow.jobId, job.id)
  })

  test('leaves a job with no eligibility rows open to every member', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    await makeAvailable(member, event.id)
    await setPreference(member, job.id, 1)

    const user = await User.findOrFail(member.id)
    await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    const rows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
    assert.lengthOf(rows, 1)
  })

  test('re-running replaces prior non-locked assignments with an exact points reversal, leaving locked rows untouched', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.create()
    const lockedJob = await JobFactory.create()
    await event
      .related('jobs')
      .sync({ [job.id]: { count: 1 }, [lockedJob.id]: { count: 1 } }, false)

    const lockedMember = await MemberFactory.create()
    const lockedUser = await User.findOrFail(lockedMember.id)
    await client
      .post('/v1/assignments')
      .loginAs(lockedUser)
      .json({ member_id: lockedMember.id, event_id: event.id, job_id: lockedJob.id, locked: true })

    const memberA = await MemberFactory.create()
    memberA.points = 50
    await memberA.save()
    await makeAvailable(memberA, event.id)
    await setPreference(memberA, job.id, 1)

    await client.post(`/v1/events/${event.id}/matching`).loginAs(lockedUser)

    const firstRun = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', memberA.id)
      .firstOrFail()
    assert.equal(firstRun.pointsDelta, 10)
    const memberAAfterFirstRun = await Member.findOrFail(memberA.id)
    assert.equal(memberAAfterFirstRun.points, 60)

    // A stronger contender now enters the pool for the same job (ranking key
    // 70 beats A's post-first-run 60/1, without sitting at the points ceiling
    // so the +10 rank-1 bonus isn't clamped away to 0).
    const memberB = await MemberFactory.create()
    memberB.points = 70
    await memberB.save()
    await makeAvailable(memberB, event.id)
    await setPreference(memberB, job.id, 1)

    await client.post(`/v1/events/${event.id}/matching`).loginAs(lockedUser)

    const aRowsAfterRerun = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', memberA.id)
    assert.lengthOf(aRowsAfterRerun, 0)
    const memberAAfterRerun = await Member.findOrFail(memberA.id)
    assert.equal(memberAAfterRerun.points, 50)

    const bRow = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', memberB.id)
      .firstOrFail()
    assert.equal(bRow.pointsDelta, 10)

    const lockedRowAfterRerun = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', lockedMember.id)
      .firstOrFail()
    assert.isTrue(lockedRowAfterRerun.locked)
    assert.equal(lockedRowAfterRerun.pointsDelta, 0)
  })
})
