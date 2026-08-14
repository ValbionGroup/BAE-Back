import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Coordination authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function scene(permissions: string[]) {
    const member = await MemberFactory.create()
    const user =
      permissions.length > 0
        ? await grantPermissions(member, permissions)
        : await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ type: 'during' }).create()
    await event.related('jobs').sync({ [job.id]: { count: 1 } }, false)
    return { member, user, event, job }
  }

  test('refuses the matching to a member without event:matching', async ({ client }) => {
    const { user, event } = await scene([])

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    response.assertStatus(403)
  })

  test('lets a member holding event:matching run it', async ({ client }) => {
    const { user, event } = await scene(['event:matching'])

    const response = await client.post(`/v1/events/${event.id}/matching`).loginAs(user)

    response.assertStatus(200)
  })

  test('refuses the close to a member without event:settle', async ({ client, assert }) => {
    const { member, user, event, job } = await scene([])
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 12,
    })

    const response = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    response.assertStatus(403)
    const row = await MemberEventAssignedJob.query().where('eventId', event.id).firstOrFail()
    assert.isNull(row.settledAt)
  })

  test('lets a member holding event:settle close the evening', async ({ client }) => {
    const { user, event } = await scene(['event:settle'])

    const response = await client.post(`/v1/events/${event.id}/settle`).loginAs(user)

    response.assertStatus(200)
  })

  test('refuses creating an assignment without assignment:write', async ({ client, assert }) => {
    const { member, user, event, job } = await scene([])

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(403)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 0)
  })

  test('refuses updating an assignment without assignment:write', async ({ client, assert }) => {
    const { member, user, event, job } = await scene([])
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 8,
    })

    const response = await client
      .put('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)
      .json({ locked: true })

    response.assertStatus(403)
    const row = await MemberEventAssignedJob.query().where('eventId', event.id).firstOrFail()
    assert.isFalse(row.locked)
  })

  test('refuses deleting an assignment without assignment:write', async ({ client, assert }) => {
    const { member, user, event, job } = await scene([])
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 8,
    })

    const response = await client
      .delete('/v1/assignments')
      .qs({ member_id: member.id, event_id: event.id, job_id: job.id })
      .loginAs(user)

    response.assertStatus(403)
    const rows = await MemberEventAssignedJob.query().where('eventId', event.id)
    assert.lengthOf(rows, 1)
  })

  test('lets a member holding assignment:write create one', async ({ client }) => {
    const { member, user, event, job } = await scene(['assignment:write'])

    const response = await client
      .post('/v1/assignments')
      .loginAs(user)
      .json({ member_id: member.id, event_id: event.id, job_id: job.id })

    response.assertStatus(200)
  })

  test('still answers 401, not 403, to anonymous callers', async ({ client }) => {
    const { event } = await scene([])

    const response = await client.post(`/v1/events/${event.id}/settle`)

    response.assertStatus(401)
  })

  test('leaves the read-only assignment index open to any member', async ({ client }) => {
    const { user } = await scene([])

    const response = await client.get('/v1/assignments').loginAs(user)

    response.assertStatus(200)
  })
})
