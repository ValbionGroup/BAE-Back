import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
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

  /**
   * `products` n'a pas de colonne de catégorie : celle d'une recette se dérive
   * de son ingrédient de plus bas `rank`. La caisse en a besoin pour ses
   * onglets, et c'est la seule source disponible.
   *
   * Deux denrées de catégories différentes, à deux rangs différents : le test
   * échouerait aussi bien si la dérivation prenait la dernière, la première par
   * ordre alphabétique, ou n'importe laquelle.
   */
  test('derives the recipe category from its lowest-rank ingredient', async ({
    client,
    assert,
  }) => {
    const { event, product, good } = await seedMenuFixture()

    const frais = await Category.create({ name: 'Frais' })
    const sec = await Category.create({ name: 'Sec' })

    good.categoryId = frais.id
    await good.save()

    const bun = await Good.create({
      name: 'Pain hot-dog x12',
      unit: 'pcs',
      brand: 'Harrys',
      categoryId: sec.id,
    })
    await product.related('goods').attach({
      [bun.id]: { quantity: 1, rank: 2, instruction: null },
    })
    await event.related('products').attach({ [product.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(200)
    // « Frais », la catégorie du rang 1 — et non « Sec », celle du rang 2.
    assert.equal(response.body().data[0].category, 'Frais')
  })

  test('reports a null category when no ingredient is categorised', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)

    response.assertStatus(200)
    // `null` et non la chaîne vide : l'écran doit pouvoir distinguer « pas de
    // catégorie » d'une catégorie nommée.
    assert.isNull(response.body().data[0].category)
  })
})

test.group('Event products — écriture du menu', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('adds a recipe to the menu', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: product.id, quantity: 220 })
      .loginAs(user)

    response.assertStatus(200)
    assert.strictEqual(response.body().data.quantity, 220)
    assert.strictEqual(response.body().data.product_id, product.id)

    // Relecture en base : la réponse pourrait refléter un modèle en mémoire.
    await event.load('products')
    assert.lengthOf(event.products, 1)
    assert.strictEqual(Number(event.products[0].$extras.pivot_quantity), 220)
  })

  test('defaults the sale price to the last known one for that product', async ({
    client,
    assert,
  }) => {
    const { event, product } = await seedMenuFixture()
    // Une soirée antérieure où l'article se vendait 350 centimes.
    const past = await Event.create({
      name: 'Bienvenue 2026',
      description: null,
      date: DateTime.fromISO('2026-01-24'),
      status: 'completed',
      duration: 3,
    })
    await past.related('products').attach({ [product.id]: { quantity: 150, price: 350 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: product.id, quantity: 10 })
      .loginAs(user)

    response.assertStatus(200)
    // Reporté depuis la dernière soirée : sans ça, tout article repartirait à 0
    // et la caisse vendrait gratuitement.
    assert.strictEqual(response.body().data.price, 350)
  })

  test('changes the production quantity of a line', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 100, price: 350 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .patch(`/v1/events/${event.id}/products/${product.id}`)
      .json({ quantity: 240 })
      .loginAs(user)

    response.assertStatus(200)
    assert.strictEqual(response.body().data.quantity, 240)
    // Le prix de vente n'était pas dans le corps : il ne doit pas bouger.
    assert.strictEqual(response.body().data.price, 350)

    await event.load('products')
    assert.strictEqual(Number(event.products[0].$extras.pivot_quantity), 240)
  })

  test('removes a line from the menu', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 100, price: 350 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .delete(`/v1/events/${event.id}/products/${product.id}`)
      .loginAs(user)

    response.assertStatus(204)
    await event.load('products')
    assert.lengthOf(event.products, 0)
  })

  test('refuses adding the same recipe twice', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 100, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: product.id, quantity: 50 })
      .loginAs(user)

    // Sans ce refus explicite, la clé primaire composite renvoie une erreur SQL
    // brute que le client ne peut pas interpréter.
    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_MENU_LINE_EXISTS')
    assert.equal(response.body().error.message, 'Cette recette est déjà au menu de la soirée.')
  })

  test('refuses an unknown recipe', async ({ client, assert }) => {
    const { event } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: 999999, quantity: 10 })
      .loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_PRODUCT_NOT_FOUND')
    assert.equal(response.body().error.message, "Cette recette n'existe pas.")
  })

  test('refuses patching a line that is not on the menu', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .patch(`/v1/events/${event.id}/products/${product.id}`)
      .json({ quantity: 10 })
      .loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_PRODUCT_NOT_FOUND')
    assert.equal(response.body().error.message, "Cette recette n'est pas au menu de cette soirée.")
  })

  test('refuses a quantity below one', async ({ client }) => {
    const { event, product } = await seedMenuFixture()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'menu:write'])

    const response = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: product.id, quantity: 0 })
      .loginAs(user)

    // Une quantité nulle voudrait dire que la ligne ne devrait pas exister, et
    // DELETE le dit déjà.
    response.assertStatus(422)
  })

  test('refuses a member without menu:write on all three writes', async ({ client, assert }) => {
    const { event, product } = await seedMenuFixture()
    await event.related('products').attach({ [product.id]: { quantity: 100, price: 0 } })

    const member = await MemberFactory.create()
    // `menu:read` seule : le compte lit le menu mais ne l'écrit pas.
    const user = await grantPermissions(member, ['menu:read'])

    const post = await client
      .post(`/v1/events/${event.id}/products`)
      .json({ product_id: product.id, quantity: 10 })
      .loginAs(user)
    const patch = await client
      .patch(`/v1/events/${event.id}/products/${product.id}`)
      .json({ quantity: 10 })
      .loginAs(user)
    const del = await client.delete(`/v1/events/${event.id}/products/${product.id}`).loginAs(user)

    for (const response of [post, patch, del]) {
      response.assertStatus(403)
      assert.equal(response.body().error.code, 'E_FORBIDDEN')
    }
  })
})
