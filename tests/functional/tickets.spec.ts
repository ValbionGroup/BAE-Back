import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Ticket from '#models/ticket'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { errorCodeOf } from '#tests/helpers/api_error'

async function notificationsFor(subjectId: number, verb: string) {
  const events = await db
    .from('activity_events')
    .where('subject_type', 'ticket')
    .where('subject_id', subjectId)
    .where('verb', verb)
    .select('id')

  if (events.length === 0) return []

  return db
    .from('notifications')
    .whereIn(
      'event_id',
      events.map((event) => Number(event.id))
    )
    .distinct('user_id')
    .select('user_id')
}

test.group('Tickets — ouverture et visibilité', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ouvrir un ticket ne demande aucune permission', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client
      .post('/v1/tickets')
      .json({ subject: 'La caisse plante', body: 'Écran blanc au scan.' })
      .loginAs(user)

    response.assertStatus(200)
    const ticket = await Ticket.query().where('authorId', user.id).firstOrFail()
    assert.equal(ticket.subject, 'La caisse plante')
    assert.equal(ticket.status, 'open')
  })

  test('sans ticket:read, on ne voit que les siens', async ({ client, assert }) => {
    const mine = await MemberFactory.create()
    const other = await MemberFactory.create()
    const me = await grantPermissions(mine, [])
    const them = await grantPermissions(other, [])

    await client.post('/v1/tickets').json({ subject: 'À moi', body: 'x' }).loginAs(me)
    await client.post('/v1/tickets').json({ subject: 'À eux', body: 'y' }).loginAs(them)

    const response = await client.get('/v1/tickets').loginAs(me)
    const rows = (response.body() as { data: { subject: string }[] }).data
    const subjects = rows.map((row) => row.subject)

    assert.include(subjects, 'À moi')
    assert.notInclude(subjects, 'À eux', 'la boîte des autres ne doit pas fuiter')
  })

  test('avec ticket:read, on voit tout', async ({ client, assert }) => {
    const support = await MemberFactory.create()
    const other = await MemberFactory.create()
    const agent = await grantPermissions(support, ['ticket:read'])
    const them = await grantPermissions(other, [])

    await client.post('/v1/tickets').json({ subject: 'Ticket tiers', body: 'y' }).loginAs(them)

    const response = await client.get('/v1/tickets').loginAs(agent)
    const rows = (response.body() as { data: { subject: string }[] }).data

    assert.include(
      rows.map((row) => row.subject),
      'Ticket tiers'
    )
  })

  test('consulter le ticket d’un autre rend 404, pas 403', async ({ client, assert }) => {
    const mine = await MemberFactory.create()
    const other = await MemberFactory.create()
    const me = await grantPermissions(mine, [])
    const them = await grantPermissions(other, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'Privé', body: 'y' })
      .loginAs(them)
    const id = (created.body() as { data: { id: number } }).data.id

    const response = await client.get(`/v1/tickets/${id}`).loginAs(me)

    response.assertStatus(404)
    assert.equal(errorCodeOf(response), 'E_NOT_FOUND')
  })
})

test.group('Tickets — les deux notifications du cahier des charges', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ouvrir un ticket notifie le support, pas son auteur', async ({ client, assert }) => {
    const support = await MemberFactory.create()
    await grantPermissions(support, ['ticket:read'])
    const author = await MemberFactory.create()
    const user = await grantPermissions(author, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'Souci de scan', body: 'rien ne se passe' })
      .loginAs(user)
    const id = (created.body() as { data: { id: number } }).data.id

    const rows = await notificationsFor(id, 'ticket.opened')
    const notified = rows.map((row) => Number(row.user_id))

    assert.include(notified, support.id)
    assert.notInclude(notified, user.id, 'on ne se notifie pas sa propre demande')
  })

  /**
   * ⚠️ Le fait doit exister **même si personne n'est notifié**. Le lier à
   * l'existence d'un porteur de `ticket:read` ferait disparaître l'ouverture du
   * fil d'activité le jour où le rôle change — l'action a eu lieu quand même.
   */
  test('enregistre l’ouverture même sans personne à notifier', async ({ client, assert }) => {
    const author = await MemberFactory.create()
    const user = await grantPermissions(author, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'Personne pour lire', body: 'x' })
      .loginAs(user)
    const id = (created.body() as { data: { id: number } }).data.id

    const facts = await db
      .from('activity_events')
      .where('subject_type', 'ticket')
      .where('subject_id', id)
      .where('verb', 'ticket.opened')

    assert.lengthOf(facts, 1, 'le fait doit être tracé indépendamment de sa livraison')
  })

  test('changer le statut notifie l’auteur', async ({ client, assert }) => {
    const support = await MemberFactory.create()
    const agent = await grantPermissions(support, ['ticket:read', 'ticket:write'])
    const author = await MemberFactory.create()
    const user = await grantPermissions(author, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'En attente', body: 'coucou' })
      .loginAs(user)
    const id = (created.body() as { data: { id: number } }).data.id

    const response = await client
      .patch(`/v1/tickets/${id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(agent)
    response.assertStatus(200)

    const rows = await notificationsFor(id, 'ticket.updated')
    const notified = rows.map((row) => Number(row.user_id))
    assert.include(notified, user.id)
  })

  /**
   * ⚠️ Le test qui garde l'absence volontaire de `dedupeKey` : un changement de
   * statut est une action humaine, pas une détection répétée. Un aller-retour
   * doit notifier à chaque fois.
   */
  test('un aller-retour de statut notifie à chaque passage', async ({ client, assert }) => {
    const support = await MemberFactory.create()
    const agent = await grantPermissions(support, ['ticket:read', 'ticket:write'])
    const author = await MemberFactory.create()
    const user = await grantPermissions(author, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'Va-et-vient', body: 'x' })
      .loginAs(user)
    const id = (created.body() as { data: { id: number } }).data.id

    await client.patch(`/v1/tickets/${id}/status`).json({ status: 'in_progress' }).loginAs(agent)
    await client.patch(`/v1/tickets/${id}/status`).json({ status: 'closed' }).loginAs(agent)
    await client.patch(`/v1/tickets/${id}/status`).json({ status: 'in_progress' }).loginAs(agent)

    const events = await db
      .from('activity_events')
      .where('subject_type', 'ticket')
      .where('subject_id', id)
      .where('verb', 'ticket.updated')

    assert.lengthOf(events, 3, 'chaque transition est un fait distinct')
  })

  test('changer le statut exige ticket:write', async ({ client }) => {
    const author = await MemberFactory.create()
    const user = await grantPermissions(author, [])

    const created = await client
      .post('/v1/tickets')
      .json({ subject: 'Pas touche', body: 'x' })
      .loginAs(user)
    const id = (created.body() as { data: { id: number } }).data.id

    const response = await client
      .patch(`/v1/tickets/${id}/status`)
      .json({ status: 'closed' })
      .loginAs(user)

    response.assertStatus(403)
  })
})
