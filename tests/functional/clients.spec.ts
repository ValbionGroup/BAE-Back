import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeClient(attrs: {
  email: string
  firstName: string
  lastName: string
  promotion?: string | null
  registeredAt?: DateTime
}): Promise<Client> {
  const user = await User.create({
    email: attrs.email,
    password: 'secret-de-test',
    // `ClientsController.store` exige une provenance EirbConnect ; les comptes
    // fabriqués directement ici la simulent.
    casId: `cas-${attrs.email}`,
    firstName: attrs.firstName,
    lastName: attrs.lastName,
  })
  return Client.create({
    id: user.id,
    phone: null,
    promotion: attrs.promotion ?? null,
    registeredAt: attrs.registeredAt ?? DateTime.now(),
  })
}

async function subscribe(userId: number, fastPassId: number, subscribedAt: DateTime) {
  await db.table('subscriptions').insert({
    user_id: userId,
    fast_pass_id: fastPassId,
    subscribed_at: subscribedAt.toSQL(),
    transaction_id: null,
    created_at: DateTime.now().toSQL(),
    updated_at: DateTime.now().toSQL(),
  })
}

test.group('Adhérents — lecture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses a member without client:read', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await httpClient.get('/v1/clients').loginAs(user)
    response.assertStatus(403)
  })

  test('a cotisation whose term has not passed is active, one past it is expired', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])

    const formula = await FastPass.create({
      label: 'Année 2025-2026',
      price: 15,
      duration: 365,
      description: null,
    })

    const upToDate = await makeClient({
      email: 'ajour@test.fr',
      firstName: 'Ada',
      lastName: 'Jour',
    })
    const lapsed = await makeClient({
      email: 'expire@test.fr',
      firstName: 'Bob',
      lastName: 'Expire',
    })
    // Jamais cotisé : ni « à jour » ni « expiré », c'est un troisième état.
    await makeClient({ email: 'externe@test.fr', firstName: 'Cléo', lastName: 'Externe' })

    await subscribe(upToDate.id, formula.id, DateTime.now().minus({ days: 10 }))
    await subscribe(lapsed.id, formula.id, DateTime.now().minus({ days: 400 }))

    const response = await httpClient.get('/v1/clients').loginAs(user)
    response.assertStatus(200)

    const byEmail = new Map(
      (response.body() as { data: { email: string; status: string }[] }).data.map((row) => [
        row.email,
        row.status,
      ])
    )
    assert.equal(byEmail.get('ajour@test.fr'), 'active')
    assert.equal(byEmail.get('expire@test.fr'), 'expired')
    assert.equal(byEmail.get('externe@test.fr'), 'none')
  })

  test('the summary counts exactly what the list shows', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])

    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    const active = await makeClient({ email: 'a@test.fr', firstName: 'A', lastName: 'A' })
    const expiring = await makeClient({ email: 'b@test.fr', firstName: 'B', lastName: 'B' })
    const expired = await makeClient({ email: 'c@test.fr', firstName: 'C', lastName: 'C' })
    await makeClient({ email: 'd@test.fr', firstName: 'D', lastName: 'D' })

    await subscribe(active.id, formula.id, DateTime.now().minus({ days: 10 }))
    // Souscrite il y a 350 jours sur 365 : expire dans 15 jours, donc « bientôt ».
    await subscribe(expiring.id, formula.id, DateTime.now().minus({ days: 350 }))
    await subscribe(expired.id, formula.id, DateTime.now().minus({ days: 400 }))

    const list = await httpClient.get('/v1/clients').loginAs(user)
    const summary = await httpClient.get('/v1/clients/summary').loginAs(user)
    summary.assertStatus(200)

    const rows = (
      list.body() as {
        data: { email: string; status: string; days_until_expiry: number | null }[]
      }
    ).data
    const counts = (summary.body() as { data: Record<string, number> }).data

    const isExpiringSoon = (row: (typeof rows)[number]) =>
      row.status === 'active' && row.days_until_expiry !== null && row.days_until_expiry <= 30

    assert.equal(counts.total, rows.length)
    assert.equal(counts.up_to_date, rows.filter((row) => row.status === 'active').length)
    assert.equal(counts.expired, rows.filter((row) => row.status === 'expired').length)
    assert.equal(counts.without_subscription, rows.filter((row) => row.status === 'none').length)
    assert.equal(counts.expiring_soon, rows.filter(isExpiringSoon).length)

    // Compté sur les seules lignes que ce test a créées : la base de dev est
    // partagée et porte déjà des cotisations proches de l'échéance, donc un
    // total absolu mesurerait le jeu de données, pas la règle.
    const mine = new Set(['a@test.fr', 'b@test.fr', 'c@test.fr', 'd@test.fr'])
    assert.equal(
      rows.filter((row) => mine.has(row.email) && isExpiringSoon(row)).length,
      1,
      'seule celle qui expire dans 15 jours compte'
    )
  })

  test('renewing early keeps the person up to date', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })
    const person = await makeClient({ email: 'e@test.fr', firstName: 'E', lastName: 'E' })

    // La plus RÉCEMMENT souscrite est l'ancienne ligne remplacée ; c'est celle
    // qui expire le plus tard qui fait foi.
    await subscribe(person.id, formula.id, DateTime.now().minus({ days: 360 }))
    await subscribe(person.id, formula.id, DateTime.now().minus({ days: 5 }))

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    response.assertStatus(200)

    const body = (response.body() as { data: { status: string; subscriptions: unknown[] } }).data
    assert.equal(body.status, 'active')
    assert.lengthOf(body.subscriptions, 2, "l'historique garde les deux lignes")
  })

  test('the membership number marks someone who never subscribed as EXT', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({
      email: 'f@test.fr',
      firstName: 'F',
      lastName: 'F',
      registeredAt: DateTime.fromISO('2025-09-12'),
    })

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    const body = (response.body() as { data: { membership_number: string } }).data
    // `padStart(4, '0')` est une largeur **minimale**, pas un format fixe : au-delà
    // de 9 999 comptes l'id déborde, et figer `\d{4}` ferait échouer ce test le jour
    // où la séquence passe le cap — sans qu'aucun contrat ne soit rompu.
    assert.match(body.membership_number, /^EXT-2025-\d{4,}$/)
    assert.include(body.membership_number, String(person.id))
  })
})

test.group('Adhérents — écriture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses a member without client:write', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({ email: 'g@test.fr', firstName: 'G', lastName: 'G' })

    const response = await httpClient
      .patch(`/v1/clients/${person.id}`)
      .json({ phone: '06 00 00 00 00' })
      .loginAs(user)
    response.assertStatus(403)
  })

  /**
   * Le compte client naît d'une connexion EirbConnect sur l'interface publique,
   * jamais du dashboard : il ne doit exister aucune route pour en fabriquer un.
   */
  test('the office has no way to create a client account', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:write', 'client:read'])

    const response = await httpClient
      .post('/v1/clients')
      .json({ email: 'jamais-connecte@test.fr' })
      .loginAs(user)
    response.assertStatus(404)
  })

  test('a partial PATCH leaves the fields it does not carry alone', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:write', 'client:read'])
    const person = await makeClient({
      email: 'i@test.fr',
      firstName: 'Inès',
      lastName: 'Dubreuil',
      promotion: '2A · Alt.',
    })

    const response = await httpClient
      .patch(`/v1/clients/${person.id}`)
      .json({ phone: '06 24 31 88 02' })
      .loginAs(user)

    response.assertStatus(200)
    await person.refresh()
    assert.equal(person.phone, '06 24 31 88 02')
    assert.equal(person.promotion, '2A · Alt.', 'un corps partiel ne doit rien effacer')
  })

  test('an internal note records its author and its date', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:write'])
    const person = await makeClient({ email: 'j@test.fr', firstName: 'J', lastName: 'J' })

    const response = await httpClient
      .patch(`/v1/clients/${person.id}`)
      .json({ note: 'Allergie noix · à signaler en cuisine.' })
      .loginAs(user)

    response.assertStatus(200)
    await person.refresh()
    assert.equal(person.noteAuthorId, user.id)
    assert.isNotNull(person.noteWrittenAt)
  })

  test('deleting a client leaves the account alone', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:delete'])
    const person = await makeClient({ email: 'k@test.fr', firstName: 'K', lastName: 'K' })

    const response = await httpClient.delete(`/v1/clients/${person.id}`).loginAs(user)
    response.assertStatus(204)

    assert.isNull(await Client.query().where('id', person.id).first())
    assert.isNotNull(await User.query().where('id', person.id).first())
  })
})
