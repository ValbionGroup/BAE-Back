import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { UserFactory } from '#database/factories/user_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { GoodFactory } from '#database/factories/good_factory'
import { EventFactory } from '#database/factories/event_factory'

test.group('Product CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a recipe and its ingredients, ranked by payload order', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const flour = await GoodFactory.create()
    const sugar = await GoodFactory.create()

    const response = await client
      .post('/v1/products')
      .json({
        name: 'Crêpe',
        isVegetarian: true,
        description: 'La base',
        recipe: 'Mélanger puis cuire.',
        goods: [
          { goodId: sugar.id, quantity: 2, instruction: 'Verser en pluie' },
          { goodId: flour.id, quantity: 5, instruction: null },
        ],
      })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db
      .from('product_goods')
      .where('product_id', response.body().data.id)
      .orderBy('rank')

    assert.deepEqual(
      rows.map((row) => ({
        goodId: row.good_id,
        quantity: row.quantity,
        rank: row.rank,
        instruction: row.instruction,
      })),
      [
        { goodId: sugar.id, quantity: 2, rank: 1, instruction: 'Verser en pluie' },
        { goodId: flour.id, quantity: 5, rank: 2, instruction: null },
      ]
    )
  })

  test('refuses a nameless recipe instead of hitting the NOT NULL column', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/v1/products')
      .json({ description: 'Sans nom' })
      .loginAs(user)

    response.assertStatus(400)
    response.assertBodyContains({ error: { code: 'E_PRODUCT_INVALID' } })
  })

  test('replaces the whole ingredient set on update', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create()
    const dropped = await GoodFactory.create()
    const kept = await GoodFactory.create()
    const added = await GoodFactory.create()
    await product.related('goods').attach({
      [dropped.id]: { quantity: 1, rank: 1, instruction: null },
      [kept.id]: { quantity: 1, rank: 2, instruction: null },
    })

    const response = await client
      .put(`/v1/products/${product.id}`)
      .json({
        name: product.name,
        goods: [
          { goodId: kept.id, quantity: 3, instruction: null },
          { goodId: added.id, quantity: 4, instruction: null },
        ],
      })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db.from('product_goods').where('product_id', product.id).orderBy('rank')
    assert.deepEqual(
      rows.map((row) => ({ goodId: row.good_id, quantity: row.quantity, rank: row.rank })),
      [
        { goodId: kept.id, quantity: 3, rank: 1 },
        { goodId: added.id, quantity: 4, rank: 2 },
      ]
    )
  })

  test('leaves the ingredients alone when the payload carries no goods key', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create()
    const good = await GoodFactory.create()
    await product
      .related('goods')
      .attach({ [good.id]: { quantity: 7, rank: 1, instruction: null } })

    const response = await client
      .put(`/v1/products/${product.id}`)
      .json({ name: 'Nom modifié' })
      .loginAs(user)

    response.assertStatus(200)
    const rows = await db.from('product_goods').where('product_id', product.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].quantity, 7)
  })

  /**
   * Each of these would otherwise reach the database and come back as a 500:
   * the repeated good violates the pivot's composite primary key, the
   * fractional quantity is truncated by the unsigned-integer column, and the
   * unknown good violates the foreign key.
   */
  test('refuses an unusable ingredient payload: {label}')
    .with([
      {
        label: 'the same good twice',
        line: (goodId: number) => [
          { goodId, quantity: 1 },
          { goodId, quantity: 2 },
        ],
      },
      { label: 'a fractional quantity', line: (goodId: number) => [{ goodId, quantity: 1.5 }] },
      { label: 'a zero quantity', line: (goodId: number) => [{ goodId, quantity: 0 }] },
      { label: 'an unknown good', line: () => [{ goodId: 999_999, quantity: 1 }] },
    ])
    .run(async ({ client, assert }, { label, line }) => {
      const user = await UserFactory.create()
      const product = await ProductFactory.create()
      const good = await GoodFactory.create()

      const response = await client
        .put(`/v1/products/${product.id}`)
        .json({ name: product.name, goods: line(good.id) })
        .loginAs(user)

      assert.equal(response.status(), 400, `expected 400 for ${label}`)
      assert.equal(response.body().error.code, 'E_PRODUCT_INVALID', `wrong code for ${label}`)
    })

  test('refuses to delete a recipe that a soirée menu still references', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create()
    const event = await EventFactory.create()
    await product.related('events').attach([event.id])

    const response = await client.delete(`/v1/products/${product.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_PRODUCT_IN_USE' } })
    const rows = await db.from('products').where('id', product.id)
    assert.lengthOf(rows, 1)
  })

  test('deletes a recipe nothing references', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const product = await ProductFactory.create()

    const response = await client.delete(`/v1/products/${product.id}`).loginAs(user)

    response.assertStatus(204)
    const rows = await db.from('products').where('id', product.id)
    assert.lengthOf(rows, 0)
  })
})
