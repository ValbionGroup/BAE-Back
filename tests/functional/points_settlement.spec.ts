import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import { DateTime } from 'luxon'
import { asCoordinator } from '#tests/helpers/permissions'
import Event from '#models/event'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import PointsRecompute from '../../commands/points_recompute.js'

async function seedMember(points = 0) {
  const member = await MemberFactory.create()
  member.points = points
  await member.save()
  const user = await asCoordinator(member)
  return { member, user }
}

async function setPreference(member: Member, jobId: number, rank: number) {
  await member.related('preferences').sync({ [jobId]: { rank } }, false)
}

async function pointsOf(memberId: number) {
  const member = await Member.findOrFail(memberId)
  return member.points
}

test.group('Event settlement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('applies the sum of the deltas and stamps settled_at', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    const otherJob = await JobFactory.merge({ type: 'during' }).create()
    const { member: memberA, user } = await seedMember(5)
    const { member: memberB } = await seedMember(0)

    await MemberEventAssignedJob.create({
      memberId: memberA.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 12,
    })
    await MemberEventAssignedJob.create({
      memberId: memberB.id,
      eventId: event.id,
      jobId: otherJob.id,
      locked: false,
      pointsDelta: -4,
    })

    const response = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { settled: 2, already_settled: 0, total_delta: 8 } })

    assert.equal(await pointsOf(memberA.id), 17)
    assert.equal(await pointsOf(memberB.id), -4)

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 2)
    for (const row of rows) {
      assert.isNotNull(row.settledAt)
    }
  })

  /**
   * La moitié qui manquait. Consolider les points et fermer la soirée sont **le
   * même geste** : la caisse et la vue live dérivent de `events.status`, donc
   * sans ce passage à `completed`, clôturer ne fermait rien — ni à l'écran, ni
   * en base.
   */
  test('la clôture ferme aussi la soirée, et la refaire ne la rouvre pas', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.merge({ status: 'ongoing' }).create()
    const { user } = await seedMember(0)

    const first = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    first.assertStatus(200)
    first.assertBodyContains({ data: { status: 'completed' } })
    const afterFirst = await Event.findOrFail(event.id)
    assert.equal(afterFirst.status, 'completed')

    const second = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    second.assertStatus(200)
    const afterSecond = await Event.findOrFail(event.id)
    assert.equal(afterSecond.status, 'completed')
  })

  test('a second settle changes nothing and reports settled: 0', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    const { member, user } = await seedMember(0)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 12,
    })

    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    const second = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    second.assertStatus(200)
    second.assertBodyContains({ data: { settled: 0, already_settled: 1, total_delta: 0 } })
    assert.equal(await pointsOf(member.id), 12)
  })

  test('settles only the rows left unsettled by a partial earlier close', async ({
    client,
    assert,
  }) => {
    const event = await EventFactory.create()
    const jobA = await JobFactory.merge({ type: 'after' }).create()
    const jobB = await JobFactory.merge({ type: 'before' }).create()
    const { member, user } = await seedMember(0)

    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: jobA.id,
      locked: false,
      pointsDelta: 12,
    })
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: jobB.id,
      locked: true,
      pointsDelta: 4,
    })

    const response = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    response.assertBodyContains({ data: { settled: 1, already_settled: 1, total_delta: 4 } })
    assert.equal(await pointsOf(member.id), 16)
  })

  test('refuses to re-run the matching of a settled evening', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    const { member, user } = await seedMember(0)
    await member.related('responses').sync({ [event.id]: { is_available: true } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 8,
    })

    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_ALREADY_SETTLED' } })

    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].pointsDelta, 8)
  })
})

test.group('Manual assignment credit', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('credits a manual assignment exactly like the engine would', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    const { member, user } = await seedMember(0)
    await setPreference(member, job.id, 2)

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(200)

    const row = await MemberEventAssignedJob.query()
      .where('memberId', member.id)
      .where('eventId', event.id)
      .where('jobId', job.id)
      .firstOrFail()
    assert.equal(row.pointsDelta, 2)
  })

  test('gives the full charge credit for an unranked job', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    const { member, user } = await seedMember(0)

    await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    const row = await MemberEventAssignedJob.query()
      .where('memberId', member.id)
      .where('eventId', event.id)
      .where('jobId', job.id)
      .firstOrFail()
    assert.equal(row.pointsDelta, 12)
  })

  test('does not recompute the delta of an existing row', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    const { member, user } = await seedMember(0)

    await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    await setPreference(member, job.id, 1)
    await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    const rows = await MemberEventAssignedJob.query()
      .where('memberId', member.id)
      .where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].pointsDelta, 12)
  })
})

test.group('Assignment deletion refund', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('leaves members.points alone when the row was never settled', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    const { member, user } = await seedMember(30)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 12,
    })

    const response = await client
      .delete('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)

    response.assertStatus(204)
    assert.equal(await pointsOf(member.id), 30)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 0)
  })

  test('takes back exactly the delta of a settled row', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'after' }).create()
    const otherJob = await JobFactory.merge({ type: 'before' }).create()
    const { member, user } = await seedMember(0)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 12,
    })
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: otherJob.id,
      locked: false,
      pointsDelta: 4,
    })
    await client.post(`/v1/events/${event.id}/settle`).loginAs(user)
    assert.equal(await pointsOf(member.id), 16)

    await client
      .delete('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)

    assert.equal(await pointsOf(member.id), 4)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].jobId, otherJob.id)
  })
})

test.group('points:recompute', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  async function seedDriftedMember() {
    const event = await EventFactory.create()
    const settledJob = await JobFactory.merge({ type: 'after' }).create()
    const pendingJob = await JobFactory.merge({ type: 'during' }).create()
    const { member } = await seedMember(0)

    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: settledJob.id,
      locked: false,
      pointsDelta: 12,
      settledAt: DateTime.now(),
    })
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: pendingJob.id,
      locked: false,
      pointsDelta: 8,
    })

    member.points = 99
    await member.save()
    return member
  }

  test('rebuilds members.points from the settled rows', async ({ assert }) => {
    const member = await seedDriftedMember()

    const command = await ace.create(PointsRecompute, [])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(member.id), 12)
  })

  test('writes nothing in dry-run', async ({ assert }) => {
    const member = await seedDriftedMember()

    const command = await ace.create(PointsRecompute, ['--dry-run'])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(member.id), 99)
  })

  test('leaves a member with no settled row at zero', async ({ assert }) => {
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    const { member } = await seedMember(42)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 8,
    })

    const command = await ace.create(PointsRecompute, [])
    await command.exec()
    command.assertSucceeded()

    assert.equal(await pointsOf(member.id), 0)
  })
})
