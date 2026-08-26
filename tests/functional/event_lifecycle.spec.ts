import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import ActivityEvent from '#models/activity_event'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { grantPermissions } from '#tests/helpers/permissions'

/**
 * ⚠️ **La base de dev est partagée et peuplée.** L'invariant « au plus une
 * soirée ouverte » interroge toute la table : sans ce nettoyage, les soirées
 * déjà `ongoing` de la base feraient échouer toute ouverture. Écrit dans la
 * transaction globale du test, donc annulé à la fin.
 */
async function closeEveryOpenEvent(): Promise<void> {
  await db.from('events').where('status', 'ongoing').update({ status: 'scheduled' })
}

function bureau() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['event:read', 'event:write', 'order:write', 'stock:write'])
  )
}

test.group('Cycle de vie d’une soirée — ouverture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ouvre une soirée planifiée et le dit au fil d’activité', async ({ client, assert }) => {
    await closeEveryOpenEvent()
    const user = await bureau()
    const event = await EventFactory.merge({ status: 'scheduled' }).create()

    const response = await client.post(`/v1/events/${event.id}/open`).loginAs(user)

    response.assertStatus(200)
    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.status, 'ongoing')

    const trace = await ActivityEvent.query()
      .where('subjectType', 'event')
      .where('subjectId', event.id)
      .where('verb', 'event.opened')
      .first()
    assert.isNotNull(trace)
  })

  test('rouvrir la soirée déjà ouverte ne change rien', async ({ client, assert }) => {
    await closeEveryOpenEvent()
    const user = await bureau()
    const event = await EventFactory.merge({ status: 'ongoing' }).create()

    const response = await client.post(`/v1/events/${event.id}/open`).loginAs(user)

    response.assertStatus(200)
    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.status, 'ongoing')
  })

  /**
   * L'invariant qui manquait : `EventsStore.activeEvent` prend la **plus
   * ancienne** des soirées ouvertes. Deux soirées ouvertes, et la caisse
   * encaisse sur celle d'avant-hier pendant que la cuisine produit pour ce soir.
   */
  test('refuse d’ouvrir une seconde soirée quand une autre est déjà en cours', async ({
    client,
    assert,
  }) => {
    await closeEveryOpenEvent()
    const user = await bureau()
    await EventFactory.merge({ name: 'Soirée en cours', status: 'ongoing' }).create()
    const other = await EventFactory.merge({ status: 'scheduled' }).create()

    const response = await client.post(`/v1/events/${other.id}/open`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_ALREADY_OPEN' } })
    const reloaded = await Event.findOrFail(other.id)
    assert.equal(reloaded.status, 'scheduled')
  })

  test('refuse de rouvrir une soirée clôturée — c’est le rôle d’event:unsettle', async ({
    client,
    assert,
  }) => {
    await closeEveryOpenEvent()
    const user = await bureau()
    const event = await EventFactory.merge({ status: 'completed' }).create()

    const response = await client.post(`/v1/events/${event.id}/open`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_CLOSED' } })
    const reloaded = await Event.findOrFail(event.id)
    assert.equal(reloaded.status, 'completed')
  })

  test('refuse l’ouverture à qui n’a pas event:write', async ({ client }) => {
    await closeEveryOpenEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['event:read'])
    const event = await EventFactory.merge({ status: 'scheduled' }).create()

    const response = await client.post(`/v1/events/${event.id}/open`).loginAs(user)
    response.assertStatus(403)
  })
})

test.group('Cycle de vie d’une soirée — ce qu’une clôture interdit', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * L'écran fermait déjà la caisse ; le serveur, lui, acceptait toujours. Un
   * onglet resté ouvert suffisait à écrire des ventes sur une soirée dont le
   * bilan était tiré et les points consolidés.
   */
  test('un encaissement sur une soirée clôturée est refusé', async ({ client, assert }) => {
    const user = await bureau()
    const event = await Event.create({
      name: 'Soirée close',
      description: null,
      date: DateTime.now().minus({ days: 1 }),
      status: 'completed',
    })

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: 1, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_CLOSED' } })
    assert.equal(await countOrders(event.id), 0)
  })

  test('un lancement de production sur une soirée clôturée est refusé', async ({ client }) => {
    const user = await bureau()
    const event = await Event.create({
      name: 'Soirée close',
      description: null,
      date: DateTime.now().minus({ days: 1 }),
      status: 'completed',
    })

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .json({ product_id: 1, quantity: 1 })
      .loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_CLOSED' } })
  })

  test('une soirée encore en cours encaisse toujours', async ({ client }) => {
    const user = await bureau()
    const event = await Event.create({
      name: 'Soirée ouverte',
      description: null,
      date: DateTime.now(),
      status: 'ongoing',
    })

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: 1, quantity: 1 }] })
      .loginAs(user)

    // Pas de 409 : le refus qui suit porte sur le menu, pas sur l'état.
    response.assertStatus(422)
  })
})

async function countOrders(eventId: number): Promise<number> {
  const row = await db.from('orders').where('event_id', eventId).count('* as total').first()
  return Number(row?.total ?? 0)
}
