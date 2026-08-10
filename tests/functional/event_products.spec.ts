import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import Supplier from '#models/supplier'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

/**
 * Une soirée, une recette d'une seule denrée, et une enseigne qui la price.
 * Monté à la main plutôt que par factories : le calcul de coût dépend de
 * valeurs précises, et une factory aléatoire rendrait les assertions illisibles.
 */
async function seedMenuFixture() {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })

  const good = await Good.create({
    name: 'Saucisses Strasbourg x10',
    unit: 'pcs',
    brand: 'Herta',
    categoryId: null,
  })

  const supplier = await Supplier.create({ name: 'Leclerc' })
  await supplier.related('goods').attach({ [good.id]: { price: 4.95 } })

  const product = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  // 2 saucisses par hot-dog.
  await product.related('goods').attach({
    [good.id]: { quantity: 2, rank: 1, instruction: 'Chauffer 3 min' },
  })

  return { event, good, supplier, product }
}

test.group('Event products — lecture du menu', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns the menu lines with their derived cost', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 220, price: 350 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(200)
    const lines = response.body().data
    assert.lengthOf(lines, 1)
    assert.equal(lines[0].product_id, product.id)
    assert.equal(lines[0].name, 'Hot-dog classique')
    assert.strictEqual(lines[0].quantity, 220)
    assert.strictEqual(lines[0].price, 350)
    // 2 saucisses × 4,95 € = 9,90 € la pièce.
    assert.strictEqual(lines[0].unit_cost, 9.9)
    assert.strictEqual(lines[0].total_cost, 2178)
  })

  test('returns an empty list for an evening with no menu', async ({ client, assert }) => {
    const { event } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
  })

  test('reports a null cost when an ingredient has no priced supplier', async ({
    client,
    assert,
  }) => {
    const { event, product } = await seedMenuFixture()
    const orphan = await Good.create({
      name: 'Oignons frits 100g',
      unit: 'pcs',
      brand: 'Maison',
      categoryId: null,
    })
    await product.related('goods').attach({
      [orphan.id]: { quantity: 1, rank: 2, instruction: null },
    })
    await event.related('products').attach({ [product.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(200)
    // Un coût partiel serait plus faux qu'un coût absent : on ne sait pas
    // combien coûte cette recette, donc on ne prétend pas le savoir.
    assert.isNull(response.body().data[0].unit_cost)
    assert.isNull(response.body().data[0].total_cost)
  })

  test('refuses an unknown evening with an explicit 404', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get('/v1/events/999999/products').loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_EVENT_NOT_FOUND')
    assert.equal(response.body().error.message, "Cette soirée n'existe pas.")
  })

  test('refuses a member without menu:read', async ({ client, assert }) => {
    const { event } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['presence:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })
})
