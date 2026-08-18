import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'

function coordinator() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['event:read', 'event:write'])
  )
}

test.group('Event settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un PATCH partiel laisse intactes les colonnes non transmises', async ({
    client,
    assert,
  }) => {
    const user = await coordinator()
    const event = await EventFactory.merge({
      description: 'Briefing à 18h',
      status: 'ongoing',
    }).create()

    const response = await client
      .patch(`/v1/events/${event.id}`)
      .json({ name: 'Soirée renommée' })
      .loginAs(user)

    response.assertStatus(200)

    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.name, 'Soirée renommée')
    // Le contrôleur écrasait ces deux colonnes avec `undefined` à chaque
    // enregistrement du panneau, qui n'envoie que trois champs.
    assert.equal(reloaded.description, 'Briefing à 18h')
    assert.equal(reloaded.status, 'ongoing')
  })

  test('écrit le plafond de précommandes, les attendus et le payeur', async ({
    client,
    assert,
  }) => {
    const user = await coordinator()
    const event = await EventFactory.create()

    const response = await client
      .patch(`/v1/events/${event.id}`)
      .json({ capacity: 150, expected_attendees: 220, payer_name: 'BDE' })
      .loginAs(user)

    response.assertStatus(200)

    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.capacity, 150)
    assert.equal(reloaded.expectedAttendees, 220)
    assert.equal(reloaded.payerName, 'BDE')
  })

  test('ouvre puis referme la soirée aux précommandes par le seul plafond', async ({
    client,
    assert,
  }) => {
    const user = await coordinator()
    const event = await EventFactory.merge({ status: 'scheduled' }).create()

    await client.patch(`/v1/events/${event.id}`).json({ capacity: 150 }).loginAs(user)
    const opened = await client.get('/v1/public/events')
    assert.isTrue(opened.body().data.some((row: { id: number }) => row.id === event.id))

    await client.patch(`/v1/events/${event.id}`).json({ capacity: 0 }).loginAs(user)
    const closed = await client.get('/v1/public/events')
    assert.isFalse(closed.body().data.some((row: { id: number }) => row.id === event.id))
  })

  test('refuse un statut hors énumération et une date illisible', async ({ client }) => {
    const user = await coordinator()
    const event = await EventFactory.create()

    const badStatus = await client
      .patch(`/v1/events/${event.id}`)
      .json({ status: 'annulée' })
      .loginAs(user)
    badStatus.assertStatus(422)

    const badDate = await client
      .patch(`/v1/events/${event.id}`)
      .json({ date: 'la semaine prochaine' })
      .loginAs(user)
    badDate.assertStatus(422)
  })
})
