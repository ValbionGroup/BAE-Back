import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'

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
