import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import Member from '#models/member'
import { EventFactory } from '#database/factories/event_factory'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { PRESENCE_PENDING, queuePresenceReminders } from '#services/presence_reminder_service'

/** Un membre porteur des permissions demandées, prêt pour `loginAs`. */
async function actorWith(...permissions: string[]): Promise<User> {
  const member = await MemberFactory.create()
  return permissions.length > 0
    ? await grantPermissions(member, permissions)
    : await User.findOrFail(member.id)
}

async function scheduledEvent(daysAhead = 2) {
  return EventFactory.merge({
    date: DateTime.now().plus({ days: daysAhead }),
    status: 'scheduled',
  }).create()
}

/**
 * ⚠️ Les assertions portent sur `already_sent` et non `alreadySent` :
 * `case_converter_middleware` snake_case la réponse sortante. Le front reçoit
 * bien `alreadySent`, son intercepteur la recamélise.
 */
test.group('POST /v1/events/:id/reminders', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('met en file les membres sans réponse', async ({ client, assert }) => {
    const event = await scheduledEvent()
    await MemberFactory.create()

    const response = await client
      .post(`/v1/events/${event.id}/reminders`)
      .loginAs(await actorWith('presence:write'))

    response.assertStatus(200)
    assert.isAbove(response.body().data.queued, 0)
    assert.equal(response.body().data.already_sent, 0)
  })

  /**
   * Sans clé propre au jour, ce second appel rendrait `queued: 0` **en annonçant
   * un succès**. Il doit dire explicitement que c'est déjà parti aujourd'hui.
   */
  test('deux relances le même jour : la seconde ne redérange personne', async ({
    client,
    assert,
  }) => {
    const event = await scheduledEvent()
    await MemberFactory.create()

    const actor = await actorWith('presence:write')
    await client.post(`/v1/events/${event.id}/reminders`).loginAs(actor)
    const second = await client.post(`/v1/events/${event.id}/reminders`).loginAs(actor)

    second.assertStatus(200)
    assert.equal(second.body().data.queued, 0)
    assert.isAbove(second.body().data.already_sent, 0)
  })

  test('une relance repart après le cron, dont la clé est différente', async ({
    client,
    assert,
  }) => {
    const event = await scheduledEvent()
    await MemberFactory.create()

    await queuePresenceReminders(PRESENCE_PENDING, 3)

    const response = await client
      .post(`/v1/events/${event.id}/reminders`)
      .loginAs(await actorWith('presence:write'))

    assert.isAbove(response.body().data.queued, 0)
  })

  test('refuse une soirée clôturée en 422', async ({ client }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().minus({ days: 2 }),
      status: 'completed',
    }).create()

    const response = await client
      .post(`/v1/events/${event.id}/reminders`)
      .loginAs(await actorWith('presence:write'))

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_EVENT_NOT_SCHEDULED' } })
  })

  test('404 sur une soirée inconnue', async ({ client }) => {
    const response = await client
      .post('/v1/events/99999999/reminders')
      .loginAs(await actorWith('presence:write'))

    response.assertStatus(404)
  })

  test('403 sans presence:write', async ({ client }) => {
    const event = await scheduledEvent()

    const response = await client
      .post(`/v1/events/${event.id}/reminders`)
      .loginAs(await actorWith('event:read'))

    response.assertStatus(403)
  })

  /**
   * ⚠️ La base de dev est partagée et peuplée : tout membre préexistant compte
   * comme sans réponse. On répond donc pour tout le monde avant d'appeler, et
   * l'acteur est créé **avant** cette insertion pour en faire partie.
   */
  test('200 avec queued 0 quand tout le monde a répondu', async ({ client, assert }) => {
    const event = await scheduledEvent()
    const actor = await actorWith('presence:write')

    const members = await Member.all()
    await db.table('member_responses').insert(
      members.map((m) => ({ member_id: m.id, event_id: event.id, is_available: true }))
    )

    const response = await client.post(`/v1/events/${event.id}/reminders`).loginAs(actor)

    response.assertStatus(200)
    assert.equal(response.body().data.queued, 0)
    assert.equal(response.body().data.already_sent, 0)
  })
})
