import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Client from '#models/client'
import Event from '#models/event'
import FastPass from '#models/fast_pass'
import Order from '#models/order'
import Product from '#models/product'
import Transaction from '#models/transaction'
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
      duration: 1,
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
      duration: 1,
      description: null,
    })

    const active = await makeClient({ email: 'a@test.fr', firstName: 'A', lastName: 'A' })
    const expiring = await makeClient({ email: 'b@test.fr', firstName: 'B', lastName: 'B' })
    const expired = await makeClient({ email: 'c@test.fr', firstName: 'C', lastName: 'C' })
    await makeClient({ email: 'd@test.fr', firstName: 'D', lastName: 'D' })

    await subscribe(active.id, formula.id, DateTime.now().minus({ days: 10 }))
    // Souscrite il y a 350 jours sur un an : expire dans une quinzaine, donc « bientôt ».
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
      duration: 1,
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

  /**
   * Le téléphone a déménagé vers `members` (§Lydia) : un client n'en a plus
   * besoin, et la fiche adhérent ne doit plus en porter la trace.
   */
  test('la fiche adhérent ne porte plus de téléphone', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({ email: 'phone-gone@test.fr', firstName: 'N', lastName: 'N' })

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    response.assertStatus(200)
    assert.notProperty(response.body().data, 'phone')
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
      .json({ note: 'Allergie noix' })
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
      .json({ note: 'Allergie noix' })
      .loginAs(user)

    response.assertStatus(200)
    await person.refresh()
    assert.equal(person.note, 'Allergie noix')
    assert.equal(person.promotion, '2A · Alt.', 'un corps partiel ne doit rien effacer')
  })

  /**
   * `promotion` dérive du claim `diplome` depuis que la DSI le transmet. Le
   * validateur ne la connaît plus, donc VineJS l'écarte du corps validé : le
   * bureau ne peut plus saisir une valeur que la prochaine connexion SSO
   * effacerait sans un mot.
   */
  test('a PATCH carrying promotion leaves it untouched: the field derives from the IdP', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:write', 'client:read'])
    const person = await makeClient({
      email: 'derive@test.fr',
      firstName: 'Inès',
      lastName: 'Dubreuil',
      promotion: '2A · Alt.',
    })

    const response = await httpClient
      .patch(`/v1/clients/${person.id}`)
      .json({ promotion: 'saisie manuelle' })
      .loginAs(user)

    response.assertStatus(200)
    await person.refresh()
    assert.equal(person.promotion, '2A · Alt.')
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

test.group('Adhérents — activité', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeMenu(priceCents: number) {
    const event = await Event.create({
      name: 'Soirée test',
      description: null,
      date: DateTime.now(),
      status: 'ongoing',
      duration: 4 * 60 * 60,
    })
    const product = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await event.related('products').attach({ [product.id]: { quantity: 100, price: priceCents } })
    return { event, product }
  }

  async function counterSale(attrs: {
    eventId: number
    clientId: number
    productId: number
    unitCents: number
    quantity: number
    status?: string
  }) {
    const order = await Order.create({
      eventId: attrs.eventId,
      clientId: attrs.clientId,
      status: attrs.status ?? 'pending',
    })
    await db.table('order_products').insert({
      order_id: order.id,
      product_id: attrs.productId,
      quantity: attrs.quantity,
      unit_price_cents: attrs.unitCents,
      list_price_cents: attrs.unitCents,
    })
  }

  async function preOrder(attrs: {
    eventId: number
    userId: number
    productId: number
    listCents: number
    quantity: number
    discountPercent: number
    paid: boolean
  }) {
    const transaction = attrs.paid ? await Transaction.create({ type: 'lydia', amount: 0 }) : null

    const [row] = await db
      .table('pre_orders')
      .insert({
        user_id: attrs.userId,
        event_id: attrs.eventId,
        status: 'pending',
        discount_percent: attrs.discountPercent,
        transaction_id: transaction?.id ?? null,
        created_at: DateTime.now().toSQL({ includeOffset: false }),
      })
      .returning('id')

    await db.table('pre_order_items').insert({
      pre_order_id: typeof row === 'object' ? Number(row.id) : Number(row),
      product_id: attrs.productId,
      quantity: attrs.quantity,
      received_quantity: 0,
      list_price_cents: attrs.listCents,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })
  }

  /**
   * Le défaut visé : additionner des prix publics au lieu des prix facturés, ou
   * oublier la remise de précommande — dans les deux cas le bureau lit un
   * « dépensé » que la caisse n'a jamais encaissé.
   */
  test('le dépensé additionne le comptoir et les précommandes payées, remise comprise', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({ email: 'act@test.fr', firstName: 'A', lastName: 'C' })
    const { event, product } = await makeMenu(350)

    await counterSale({
      eventId: event.id,
      clientId: person.id,
      productId: product.id,
      unitCents: 500,
      quantity: 2,
    })
    await preOrder({
      eventId: event.id,
      userId: person.id,
      productId: product.id,
      listCents: 350,
      quantity: 2,
      discountPercent: 10,
      paid: true,
    })

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    const body = response.body() as { data: { spent_cents: number; pre_order_count: number } }

    // 1000 au comptoir, plus 700 de précommande moins 10 %.
    assert.equal(body.data.spent_cents, 1630)
    assert.equal(body.data.pre_order_count, 1)
  })

  /**
   * Le défaut visé, distinct : compter ce que personne n'a payé. Une commande
   * annulée et une précommande sans transaction gonfleraient le total.
   */
  test('ni commande annulée ni précommande impayée ne comptent dans le dépensé', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({ email: 'excl@test.fr', firstName: 'E', lastName: 'X' })
    const { event, product } = await makeMenu(350)

    await counterSale({
      eventId: event.id,
      clientId: person.id,
      productId: product.id,
      unitCents: 900,
      quantity: 1,
      status: 'cancelled',
    })
    await preOrder({
      eventId: event.id,
      userId: person.id,
      productId: product.id,
      listCents: 800,
      quantity: 1,
      discountPercent: 0,
      paid: false,
    })

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    const body = response.body() as { data: { spent_cents: number; pre_order_count: number } }

    assert.equal(
      body.data.spent_cents,
      0,
      'la commande annulée et la précommande impayée sont hors du total'
    )
    // La précommande impayée reste une précommande : elle se compte, sans peser.
    assert.equal(body.data.pre_order_count, 1)
  })
})

test.group('Adhérents — consigne du client', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('la fiche porte la consigne écrite par l’adhérent', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient({ email: 'p@test.fr', firstName: 'P', lastName: 'N' })
    person.preparationNote = 'Allergie arachide'
    await person.save()

    const response = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.preparation_note, 'Allergie arachide')
  })

  /**
   * Le garde-fou symétrique de celui d'`account_profile_update` : la consigne
   * appartient à l'adhérent. Un PATCH du bureau qui la porterait ne doit pas
   * pouvoir écraser en silence une déclaration d'allergie.
   */
  test('le bureau ne peut pas écrire la consigne', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:write', 'client:read'])
    const person = await makeClient({ email: 'q@test.fr', firstName: 'Q', lastName: 'N' })
    person.preparationNote = 'Allergie arachide'
    await person.save()

    await httpClient
      .patch(`/v1/clients/${person.id}`)
      .json({ preparation_note: 'effacée par le bureau' })
      .loginAs(user)

    await person.refresh()
    assert.equal(person.preparationNote, 'Allergie arachide')
  })
})
