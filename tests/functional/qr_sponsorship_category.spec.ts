import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { decodeJwt } from 'jose'
import Product from '#models/product'
import SponsorshipCategory from '#models/sponsorship_category'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'

function manager() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['menu:read', 'menu:write', 'order:write'])
  )
}

async function seed() {
  const event = await EventFactory.merge({ payerName: 'BDE' }).create()
  const product = await Product.create({
    name: 'Burger maison',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  await event.related('products').attach({ [product.id]: { quantity: 100, price: 400 } })

  const category = await SponsorshipCategory.create({
    eventId: event.id,
    label: 'Staff BDE',
    qrNonce: 'nonce-initial',
  })

  return { event, product, category }
}

async function placeOrders(eventId: number, categoryId: number, count: number, status = 'pending') {
  for (let index = 0; index < count; index += 1) {
    await db.table('orders').insert({
      event_id: eventId,
      status,
      sponsorship_category_id: categoryId,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }
}

test.group('QR de catégorie', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('émet un jeton sans utilisateur ni échéance', async ({ client, assert }) => {
    const { event, category } = await seed()
    const user = await manager()

    const response = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    response.assertStatus(200)

    const claims = decodeJwt(response.body().data.token)
    assert.equal(claims.type, 'sponsorship_category')
    assert.equal(claims.categoryId, category.id)
    // Deux exigences métier, pas des détails : le QR ne désigne personne et ne
    // meurt pas en pleine soirée.
    assert.isUndefined(claims.userId)
    assert.isUndefined(claims.exp)
  })

  test('exige menu:write pour l’émission', async ({ client }) => {
    const { event, category } = await seed()
    const reader = await MemberFactory.create().then((member) =>
      grantPermissions(member, ['menu:read'])
    )

    const response = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(reader)

    response.assertStatus(403)
  })

  test('rend la catégorie et sa grille au scan', async ({ client, assert }) => {
    const { event, product, category } = await seed()
    const user = await manager()

    await client
      .put(`/v1/events/${event.id}/sponsorship-categories/${category.id}/prices`)
      .json({ prices: [{ product_id: product.id, price_cents: 150 }] })
      .loginAs(user)

    const emitted = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    const scanned = await client
      .post('/v1/qr/verify')
      .json({ token: emitted.body().data.token })
      .loginAs(user)

    scanned.assertStatus(200)
    assert.equal(scanned.body().data.kind, 'sponsorship_category')
    assert.equal(scanned.body().data.category.label, 'Staff BDE')
    assert.equal(scanned.body().data.category.payer_name, 'BDE')
    assert.deepEqual(scanned.body().data.category.prices, [
      { product_id: product.id, price_cents: 150 },
    ])
  })

  test('la régénération tue l’ancien jeton et valide le nouveau', async ({ client, assert }) => {
    const { event, category } = await seed()
    const user = await manager()

    const before = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    await client
      .post(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr/rotate`)
      .loginAs(user)

    const stale = await client
      .post('/v1/qr/verify')
      .json({ token: before.body().data.token })
      .loginAs(user)
    stale.assertStatus(422)
    stale.assertBodyContains({ error: { code: 'E_CATEGORY_REVOKED' } })

    const after = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)
    const fresh = await client
      .post('/v1/qr/verify')
      .json({ token: after.body().data.token })
      .loginAs(user)

    fresh.assertStatus(200)
    assert.equal(fresh.body().data.category.id, category.id)
  })
  test('annonce au comptoir ce qu’il reste au QR', async ({ client, assert }) => {
    const { event, category } = await seed()
    const user = await manager()
    category.maxOrders = 10
    await category.save()
    await placeOrders(event.id, category.id, 3)

    const emitted = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    const scanned = await client
      .post('/v1/qr/verify')
      .json({ token: emitted.body().data.token })
      .loginAs(user)

    scanned.assertStatus(200)
    assert.equal(scanned.body().data.category.max_orders, 10)
    assert.equal(scanned.body().data.category.used_orders, 3)
  })

  test('refuse le scan quand le QR a épuisé son quota', async ({ client }) => {
    const { event, category } = await seed()
    const user = await manager()
    category.maxOrders = 2
    await category.save()
    await placeOrders(event.id, category.id, 2)

    const emitted = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    const scanned = await client
      .post('/v1/qr/verify')
      .json({ token: emitted.body().data.token })
      .loginAs(user)

    // 422 et non 401 : un QR mort ne doit pas déconnecter le comptoir.
    scanned.assertStatus(422)
    scanned.assertBodyContains({ error: { code: 'E_CATEGORY_EXHAUSTED' } })
  })

  test('accepte encore le scan sur la dernière commande du quota', async ({ client, assert }) => {
    const { event, category } = await seed()
    const user = await manager()
    category.maxOrders = 3
    await category.save()
    await placeOrders(event.id, category.id, 2)

    const emitted = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    const scanned = await client
      .post('/v1/qr/verify')
      .json({ token: emitted.body().data.token })
      .loginAs(user)

    scanned.assertStatus(200)
    assert.equal(scanned.body().data.category.used_orders, 2)
  })

  test('rend son quota au QR quand une commande est annulée', async ({ client }) => {
    const { event, category } = await seed()
    const user = await manager()
    category.maxOrders = 1
    await category.save()
    await placeOrders(event.id, category.id, 1, 'cancelled')

    const emitted = await client
      .get(`/v1/events/${event.id}/sponsorship-categories/${category.id}/qr`)
      .loginAs(user)

    const scanned = await client
      .post('/v1/qr/verify')
      .json({ token: emitted.body().data.token })
      .loginAs(user)

    scanned.assertStatus(200)
  })
})
