import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
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
    stale.assertStatus(401)
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
})
