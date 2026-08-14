import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import MemberEventAssignedJob from '#models/member_event_assigned_job'

test.group('Event availability', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('upserts the current member availability without duplicating rows', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()

    const created = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: true })
    created.assertStatus(200)
    created.assertBody({ data: 1 })

    const read = await client.get(`/v1/events/${event.id}/response`).loginAs(user)
    read.assertBody({ data: 1 })

    const updated = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })
    updated.assertBody({ data: 0 })

    const rows = await member.related('responses').query().where('events.id', event.id)
    assert.lengthOf(rows, 1)
  })

  test('returns -1 for a member who has not answered', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()

    const response = await client.get(`/v1/events/${event.id}/response`).loginAs(user)
    response.assertBody({ data: -1 })
  })
})

test.group('Event availability — presence lock (D8, D9)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a member holding a job is refused when declaring themselves absent', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    await member.related('responses').sync({ [event.id]: { is_available: true } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_PRESENCE_LOCKED_BY_ASSIGNMENT' } })

    const row = await member.related('responses').query().where('events.id', event.id).first()
    assert.equal(row?.$extras.pivot_is_available, true)
  })

  test('the same member can still confirm their presence', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    await member.related('responses').sync({ [event.id]: { is_available: true } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: true })

    response.assertStatus(200)
    response.assertBody({ data: 1 })
  })

  test('a member holding no job can still declare themselves absent', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()

    const response = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })

    response.assertStatus(200)
    response.assertBody({ data: 0 })
  })

  test('once released via DELETE /v1/assignments, the member can declare themselves absent', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    // `DELETE /v1/assignments` now requires `assignment:write` — the release
    // this test describes is coordination work, so the caller carries it.
    const user = await grantPermissions(member, ['assignment:write'])
    const event = await EventFactory.create()
    const job = await JobFactory.create()

    await member.related('responses').sync({ [event.id]: { is_available: true } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const blocked = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })
    blocked.assertStatus(409)

    await client
      .delete('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)

    const released = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })

    released.assertStatus(200)
    released.assertBody({ data: 0 })

    const row = await member.related('responses').query().where('events.id', event.id).first()
    assert.equal(row?.$extras.pivot_is_available, false)
  })

  test('a member locked on a single period is still blocked for the whole evening (D9)', async ({
    client,
  }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const cleanupJob = await JobFactory.merge({ type: 'after' }).create()

    await member.related('responses').sync({ [event.id]: { is_available: true } }, false)
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: cleanupJob.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client
      .post(`/v1/events/${event.id}/response`)
      .loginAs(user)
      .json({ is_available: false })

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_PRESENCE_LOCKED_BY_ASSIGNMENT' } })
  })
})
