import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'

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
