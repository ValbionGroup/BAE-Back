import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { ProductFactory } from '#database/factories/product_factory'
import { FurnitureFactory } from '#database/factories/furniture_factory'

/**
 * Le pivot `product_furnitures` est le **seul** chemin par lequel une fourniture
 * atteint une liste de courses (`shopping_list_service` parcourt
 * `product.furnitures`). Sans écriture, il ne se remplissait qu'au seeder.
 *
 * ⚠️ Sa colonne `quantity` est un `integer unsigned`, là où `product_goods`
 * porte un décimal : une quantité fractionnaire y serait **arrondie en
 * silence** par Postgres. D'où le refus explicite, testé plus bas.
 */
test.group('Product furnitures', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function asProductManager() {
    const member = await MemberFactory.create()
    return grantPermissions(member, ['product:write', 'product:read'])
  }

  test('creates a recipe with its furnitures', async ({ client, assert }) => {
    const user = await asProductManager()
    const cups = await FurnitureFactory.create()
    const napkins = await FurnitureFactory.create()

    const response = await client
      .post('/v1/products')
      .json({
        name: 'Hot-dog',
        furnitures: [
          { furnitureId: cups.id, quantity: 1 },
          { furnitureId: napkins.id, quantity: 2 },
        ],
      })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db
      .from('product_furnitures')
      .where('product_id', response.body().data.id)
      .orderBy('furniture_id')

    assert.deepEqual(
      rows.map((row) => ({ furnitureId: row.furniture_id, quantity: Number(row.quantity) })),
      [
        { furnitureId: cups.id, quantity: 1 },
        { furnitureId: napkins.id, quantity: 2 },
      ].sort((a, b) => a.furnitureId - b.furnitureId)
    )
  })

  test('replaces the whole furniture set on update', async ({ client, assert }) => {
    const user = await asProductManager()
    const product = await ProductFactory.create()
    const dropped = await FurnitureFactory.create()
    const kept = await FurnitureFactory.create()
    const added = await FurnitureFactory.create()
    await product.related('furnitures').attach({
      [dropped.id]: { quantity: 1 },
      [kept.id]: { quantity: 1 },
    })

    const response = await client
      .put(`/v1/products/${product.id}`)
      .json({
        name: product.name,
        furnitures: [
          { furnitureId: kept.id, quantity: 3 },
          { furnitureId: added.id, quantity: 4 },
        ],
      })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db
      .from('product_furnitures')
      .where('product_id', product.id)
      .orderBy('furniture_id')
    assert.deepEqual(
      rows.map((row) => ({ furnitureId: row.furniture_id, quantity: Number(row.quantity) })),
      [
        { furnitureId: kept.id, quantity: 3 },
        { furnitureId: added.id, quantity: 4 },
      ].sort((a, b) => a.furnitureId - b.furnitureId)
    )
  })

  test('empties the furnitures when the payload carries an empty list', async ({
    client,
    assert,
  }) => {
    const user = await asProductManager()
    const product = await ProductFactory.create()
    const furniture = await FurnitureFactory.create()
    await product.related('furnitures').attach({ [furniture.id]: { quantity: 2 } })

    const response = await client
      .put(`/v1/products/${product.id}`)
      .json({ name: product.name, furnitures: [] })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db.from('product_furnitures').where('product_id', product.id)
    assert.lengthOf(rows, 0)
  })

  test('leaves the furnitures alone when the payload carries no furnitures key', async ({
    client,
    assert,
  }) => {
    const user = await asProductManager()
    const product = await ProductFactory.create()
    const furniture = await FurnitureFactory.create()
    await product.related('furnitures').attach({ [furniture.id]: { quantity: 7 } })

    const response = await client
      .put(`/v1/products/${product.id}`)
      .json({ name: 'Nom modifié' })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db.from('product_furnitures').where('product_id', product.id)
    assert.lengthOf(rows, 1)
    assert.equal(Number(rows[0].quantity), 7)
  })

  test('refuses an unusable furniture payload: {label}')
    .with([
      {
        label: 'the same furniture twice',
        line: (id: number) => [
          { furnitureId: id, quantity: 1 },
          { furnitureId: id, quantity: 2 },
        ],
      },
      { label: 'a negative quantity', line: (id: number) => [{ furnitureId: id, quantity: -1 }] },
      { label: 'a zero quantity', line: (id: number) => [{ furnitureId: id, quantity: 0 }] },
      {
        label: 'a quantity that is not a number',
        line: (id: number) => [{ furnitureId: id, quantity: 'x' }],
      },
      {
        label: 'a fractional quantity the integer column would silently round',
        line: (id: number) => [{ furnitureId: id, quantity: 1.5 }],
      },
      { label: 'an unknown furniture', line: () => [{ furnitureId: 999_999, quantity: 1 }] },
      { label: 'something that is not a list', line: () => ({ furnitureId: 1, quantity: 1 }) },
    ])
    .run(async ({ client, assert }, { label, line }) => {
      const user = await asProductManager()
      const product = await ProductFactory.create()
      const furniture = await FurnitureFactory.create()

      const response = await client
        .put(`/v1/products/${product.id}`)
        .json({ name: product.name, furnitures: line(furniture.id) })
        .loginAs(user)

      assert.equal(response.status(), 400, `expected 400 for ${label}`)
      assert.equal(response.body().error.code, 'E_PRODUCT_INVALID', `wrong code for ${label}`)
    })

  /**
   * La modale d'édition relit la recette par cette route : sans quantité
   * aplatie, elle ne pourrait pas pré-remplir ses lignes — la quantité vit sur
   * le pivot, que Lucid sérialise dans `meta`.
   */
  test('exposes the furnitures of a recipe, quantity flattened', async ({ client, assert }) => {
    const user = await asProductManager()
    const product = await ProductFactory.create()
    const furniture = await FurnitureFactory.create()
    await product.related('furnitures').attach({ [furniture.id]: { quantity: 3 } })

    const response = await client.get(`/v1/products/${product.id}`).loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data.furnitures, [
      { id: furniture.id, name: furniture.name, quantity: 3 },
    ])
  })
})
