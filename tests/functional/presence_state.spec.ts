import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { presenceStates } from '#services/presence_service'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'

test.group('presenceStates — le troisième état est l’absence de ligne', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('distingue pending, in et out', async ({ assert }) => {
    const event = await EventFactory.create()
    const pending = await MemberFactory.create()
    const present = await MemberFactory.create()
    const absent = await MemberFactory.create()

    await db.table('member_responses').insert([
      { member_id: present.id, event_id: event.id, is_available: true },
      { member_id: absent.id, event_id: event.id, is_available: false },
    ])

    const states = await presenceStates(event.id)

    assert.equal(states.get(pending.id), 'pending', 'aucune ligne = pas encore répondu')
    assert.equal(states.get(present.id), 'in')
    assert.equal(
      states.get(absent.id),
      'out',
      'is_available=false est une abstention EXPLICITE, pas une absence de réponse'
    )
  })

  test('une réponse sur une autre soirée ne compte pas', async ({ assert }) => {
    const event = await EventFactory.create()
    const other = await EventFactory.create()
    const member = await MemberFactory.create()

    await db
      .table('member_responses')
      .insert({ member_id: member.id, event_id: other.id, is_available: true })

    const states = await presenceStates(event.id)

    assert.equal(states.get(member.id), 'pending')
  })
})
