import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { asCoordinator } from '#tests/helpers/permissions'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import { MemberEventAssignedJobFactory } from '#database/factories/member_event_assigned_job_factory'

interface MatchedRow {
  member_id: number
  job_id: number
  period: string
  rank_achieved: number | null
  points_delta: number
}

interface LockedRow {
  member_id: number
  job_id: number
  period: string
}

interface MatchingBody {
  data: {
    matched: MatchedRow[]
    unmatched_member_ids: number[]
    locked: LockedRow[]
  }
}

async function makeAvailable(member: Member, eventId: number) {
  await member.related('responses').sync({ [eventId]: { is_available: true } }, false)
}

async function setPreference(member: Member, jobId: number, rank: number) {
  await member.related('preferences').sync({ [jobId]: { rank } }, false)
}

async function assignmentSignature(eventId: number): Promise<string[]> {
  const rows = await MemberEventAssignedJob.query().where('eventId', eventId)
  return rows.map((row) => `${row.jobId}:${row.memberId}`).sort()
}

test.group('Event matching', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sources the job-side ranking key from real attendance history, not raw points alone', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

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
        settledAt: DateTime.now(),
      }).create()
    }

    const memberB = await MemberFactory.create()
    memberB.points = 10
    await memberB.save()

    await makeAvailable(memberA, event.id)
    await makeAvailable(memberB, event.id)
    await setPreference(memberA, job.id, 1)
    await setPreference(memberB, job.id, 1)

    const user = await asCoordinator(memberA)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].memberId, memberB.id)
  })

  test('ignores evenings whose points have not been consolidated yet', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

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
        pointsDelta: 12,
      }).create()
    }

    const memberB = await MemberFactory.create()
    memberB.points = 10
    await memberB.save()

    await makeAvailable(memberA, event.id)
    await makeAvailable(memberB, event.id)
    await setPreference(memberA, job.id, 1)
    await setPreference(memberB, job.id, 1)

    const user = await asCoordinator(memberA)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].memberId, memberA.id)
  })

  test('counts attendance in evenings worked, not in assignment rows held', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const memberA = await MemberFactory.create()
    memberA.points = 60
    await memberA.save()
    const pastEventOfA = await EventFactory.create()
    for (let i = 0; i < 3; i++) {
      const pastJob = await JobFactory.create()
      await MemberEventAssignedJobFactory.merge({
        memberId: memberA.id,
        eventId: pastEventOfA.id,
        jobId: pastJob.id,
        settledAt: DateTime.now(),
      }).create()
    }

    const memberB = await MemberFactory.create()
    memberB.points = 60
    await memberB.save()
    for (let i = 0; i < 2; i++) {
      const pastEvent = await EventFactory.create()
      const pastJob = await JobFactory.create()
      await MemberEventAssignedJobFactory.merge({
        memberId: memberB.id,
        eventId: pastEvent.id,
        jobId: pastJob.id,
        settledAt: DateTime.now(),
      }).create()
    }

    await makeAvailable(memberA, event.id)
    await makeAvailable(memberB, event.id)
    await setPreference(memberA, job.id, 1)
    await setPreference(memberB, job.id, 1)

    const user = await asCoordinator(memberA)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].memberId, memberA.id)
  })

  test('assigns the reference scenario one job per period, skipping the second `during` job', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const installation = await JobFactory.merge({ type: 'before' }).create()
    const service = await JobFactory.merge({ type: 'during' }).create()
    const barbeuc = await JobFactory.merge({ type: 'during' }).create()
    const vaisselle = await JobFactory.merge({ type: 'after' }).create()
    await event.related('jobs').sync(
      {
        [installation.id]: { count: 1 },
        [service.id]: { count: 1 },
        [barbeuc.id]: { count: 1 },
        [vaisselle.id]: { count: 1 },
      },
      false
    )

    const member = await MemberFactory.create()
    member.points = 30
    await member.save()
    await makeAvailable(member, event.id)
    await setPreference(member, service.id, 1)
    await setPreference(member, barbeuc.id, 2)
    await setPreference(member, installation.id, 3)
    await setPreference(member, vaisselle.id, 4)

    const user = await asCoordinator(member)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 3)

    const deltaByJob = new Map(rows.map((row) => [row.jobId, row.pointsDelta]))
    assert.equal(deltaByJob.get(installation.id), 4) // before, rank 3 -> 12 - 8
    assert.equal(deltaByJob.get(service.id), -4) // during, rank 1 -> 8 - 12
    assert.equal(deltaByJob.get(vaisselle.id), 6) // after, rank 4 -> 12 - 6
    assert.isFalse(deltaByJob.has(barbeuc.id))

    const body = response.body() as MatchingBody
    const periodByJob = new Map(body.data.matched.map((row) => [row.job_id, row.period]))
    assert.equal(periodByJob.get(installation.id), 'before')
    assert.equal(periodByJob.get(service.id), 'during')
    assert.equal(periodByJob.get(vaisselle.id), 'after')
  })

  test('still assigns an `after` job to a member locked on a `during` job', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const afterJob = await JobFactory.merge({ type: 'after' }).create()
    await event
      .related('jobs')
      .sync({ [duringJob.id]: { count: 1 }, [afterJob.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    await makeAvailable(member, event.id)
    const user = await asCoordinator(member)
    await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: duringJob.id, locked: true })

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const rows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
    assert.lengthOf(rows, 2)

    const afterRow = rows.find((row) => row.jobId === afterJob.id)
    assert.isDefined(afterRow)
    assert.isFalse(afterRow!.locked)
    assert.equal(afterRow!.pointsDelta, 12) // after, unranked -> 12 - 0

    const duringRow = rows.find((row) => row.jobId === duringJob.id)
    assert.isTrue(duringRow!.locked)

    const body = response.body() as MatchingBody
    assert.deepEqual(body.data.locked, [
      { member_id: member.id, job_id: duringJob.id, period: 'during' },
    ])
  })

  test('assigns a member who expressed no preference at all, with a null rank', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    await makeAvailable(member, event.id)

    const user = await asCoordinator(member)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const row = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
      .firstOrFail()
    assert.equal(row.jobId, job.id)
    assert.equal(row.pointsDelta, 8) // during, unranked -> 8 - 0

    const body = response.body() as MatchingBody
    const matched = body.data.matched.find((r) => r.member_id === member.id)
    assert.isNull(matched!.rank_achieved)
    assert.deepEqual(body.data.unmatched_member_ids, [])
  })

  test('assigns an available member to an offered job they never ranked, instead of leaving them out', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const offeredJob = await JobFactory.merge({ type: 'during' }).create()
    const unofferedJob = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [offeredJob.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    member.points = 40
    await member.save()
    await makeAvailable(member, event.id)
    await setPreference(member, unofferedJob.id, 1)

    const user = await asCoordinator(member)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const row = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
      .firstOrFail()
    assert.equal(row.jobId, offeredJob.id)
    assert.equal(row.pointsDelta, 8)

    const body = response.body() as MatchingBody
    const matched = body.data.matched.find((r) => r.member_id === member.id)
    assert.isNull(matched!.rank_achieved)

    const updated = await Member.findOrFail(member.id)
    assert.equal(updated.points, 40)
  })

  test('respects a manual lock: reserves its capacity within the period and never touches the row', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const lockedMember = await MemberFactory.create()
    lockedMember.points = 30
    await lockedMember.save()
    const lockedUser = await asCoordinator(lockedMember)
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
    assert.equal(lockedRow.pointsDelta, 8)

    const refreshedLockedMember = await Member.findOrFail(lockedMember.id)
    assert.equal(refreshedLockedMember.points, 30)

    const body = response.body() as MatchingBody
    assert.deepEqual(body.data.unmatched_member_ids, [contender.id])
  })

  test('a manual assignment survives a matching run even when `locked` is omitted on creation', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const manualMember = await MemberFactory.create()
    const manualUser = await asCoordinator(manualMember)
    await client
      .post('/v1/assignments')
      .loginAs(manualUser)
      .json({ member_id: manualMember.id, event_id: event.id, job_id: job.id })

    const contender = await MemberFactory.create()
    contender.points = 90
    await contender.save()
    await makeAvailable(contender, event.id)
    await setPreference(contender, job.id, 1)

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(manualUser)
    response.assertStatus(200)

    const manualRow = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', manualMember.id)
      .firstOrFail()
    assert.isTrue(manualRow.locked)

    const contenderRows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', contender.id)
    assert.lengthOf(contenderRows, 0)
  })

  test('excludes an ineligible member from a restricted job even when it is their top preference', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

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

    const user = await asCoordinator(ineligibleMember)
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
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)

    const member = await MemberFactory.create()
    await makeAvailable(member, event.id)
    await setPreference(member, job.id, 1)

    const user = await asCoordinator(member)
    await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    const rows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', member.id)
    assert.lengthOf(rows, 1)
  })

  test('leaves `after` slots empty rather than filling them with members no eligibility rule allows', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const afterJob = await JobFactory.merge({ type: 'after' }).create()
    await event
      .related('jobs')
      .sync({ [duringJob.id]: { count: 2 }, [afterJob.id]: { count: 1 } }, false)

    const absentee = await MemberFactory.create()
    await afterJob.related('eligibleMembers').sync({ [absentee.id]: {} }, false)

    const memberA = await MemberFactory.create()
    await makeAvailable(memberA, event.id)
    const memberB = await MemberFactory.create()
    await makeAvailable(memberB, event.id)

    const user = await asCoordinator(memberA)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const afterRows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('jobId', afterJob.id)
    assert.lengthOf(afterRows, 0)

    const duringRows = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('jobId', duringJob.id)
    assert.lengthOf(duringRows, 2)
  })

  test('produces exactly the same assignments on two consecutive runs', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const beforeJob = await JobFactory.merge({ type: 'before' }).create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    const afterJob = await JobFactory.merge({ type: 'after' }).create()
    await event.related('jobs').sync(
      {
        [beforeJob.id]: { count: 1 },
        [duringJob.id]: { count: 1 },
        [afterJob.id]: { count: 1 },
      },
      false
    )

    const members: Member[] = []
    for (let i = 0; i < 3; i++) {
      const member = await MemberFactory.create()
      member.points = 50
      await member.save()
      await makeAvailable(member, event.id)
      members.push(member)
    }

    const user = await asCoordinator(members[0])
    await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    const firstRun = await assignmentSignature(event.id)

    await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    const secondRun = await assignmentSignature(event.id)

    assert.isAbove(firstRun.length, 0)
    assert.deepEqual(secondRun, firstRun)
  })

  test('never writes to members.points', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const beforeJob = await JobFactory.merge({ type: 'before' }).create()
    const duringJob = await JobFactory.merge({ type: 'during' }).create()
    await event
      .related('jobs')
      .sync({ [beforeJob.id]: { count: 1 }, [duringJob.id]: { count: 1 } }, false)

    const memberA = await MemberFactory.create()
    memberA.points = 50
    await memberA.save()
    await makeAvailable(memberA, event.id)
    await setPreference(memberA, duringJob.id, 1)

    const memberB = await MemberFactory.create()
    memberB.points = 70
    await memberB.save()
    await makeAvailable(memberB, event.id)
    await setPreference(memberB, beforeJob.id, 1)

    const user = await asCoordinator(memberA)
    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)
    response.assertStatus(200)

    const refreshedA = await Member.findOrFail(memberA.id)
    const refreshedB = await Member.findOrFail(memberB.id)
    assert.equal(refreshedA.points, 50)
    assert.equal(refreshedB.points, 70)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.isAbove(rows.length, 0)
  })

  test('re-running replaces prior non-locked assignments without touching members.points, leaving locked rows untouched', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    const lockedJob = await JobFactory.merge({ type: 'during' }).create()
    await event
      .related('jobs')
      .sync({ [job.id]: { count: 1 }, [lockedJob.id]: { count: 1 } }, false)

    const lockedMember = await MemberFactory.create()
    const lockedUser = await asCoordinator(lockedMember)
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
    assert.equal(firstRun.jobId, job.id)
    assert.equal(firstRun.pointsDelta, -4) // during, rank 1
    const aAfterFirstRun = await Member.findOrFail(memberA.id)
    assert.equal(aAfterFirstRun.points, 50)

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
    const aAfterRerun = await Member.findOrFail(memberA.id)
    assert.equal(aAfterRerun.points, 50)

    const bRow = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', memberB.id)
      .firstOrFail()
    assert.equal(bRow.jobId, job.id)
    assert.equal(bRow.pointsDelta, -4)
    const bAfterRerun = await Member.findOrFail(memberB.id)
    assert.equal(bAfterRerun.points, 70)

    const lockedRowAfterRerun = await MemberEventAssignedJob.query()
      .where('eventId', event.id)
      .where('memberId', lockedMember.id)
      .firstOrFail()
    assert.isTrue(lockedRowAfterRerun.locked)
    assert.equal(lockedRowAfterRerun.pointsDelta, 8)
  })
})
