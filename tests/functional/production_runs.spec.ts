import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import ProductionRun from '#models/production_run'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeEvent(name = 'Soirée test') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })
}

async function makeGood(name: string, unit = 'pcs') {
  return Good.create({ name, unit, brand: 'Marque', categoryId: null })
}

async function batch(good: Good, label: string, quantity: number, daysToDlc: number) {
  return StockBatch.create({
    goodId: good.id,
    restockId: null,
    label,
    quantity: String(quantity),
    expirationDate: DateTime.now().plus({ days: daysToDlc }),
  })
}

async function makeRecipe(name: string, ingredients: [Good, number][]) {
  const product = await Product.create({
    name,
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  let rank = 1
  for (const [good, quantity] of ingredients) {
    await product.related('goods').attach({
      [good.id]: { quantity, rank: rank++, instruction: null },
    })
  }
  return product
}

async function countOf(query: {
  count(c: string): Promise<{ $extras: Record<string, string> }[]>
}) {
  const [row] = await query.count('* as total')
  return Number(row.$extras.total)
}

test.group('Production runs — cycle de vie', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses to delete a recipe that has already been produced', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['product:delete'])
    const event = await makeEvent()
    const product = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await ProductionRun.create({
      eventId: event.id,
      productId: product.id,
      quantity: 200,
      memberId: member.id,
    })

    const response = await client.delete(`/v1/products/${product.id}`).loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PRODUCT_IN_USE')
    assert.include(response.body().error.message, 'production')
  })
})

test.group('Production runs — lancement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('writes one out movement per picked batch', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 6, 5)
    await batch(good, 'L26-2', 20, 30)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .loginAs(user)
      .json({ productId: recipe.id, quantity: 15 })

    response.assertStatus(200)
    const run = await ProductionRun.query().where('eventId', event.id).firstOrFail()
    assert.equal(run.quantity, 15)

    const movements = await StockMovement.query().where('productionRunId', run.id).orderBy('id')
    assert.deepEqual(
      movements.map((m) => [Number(m.quantity), m.movementType]),
      [
        [6, 'out'],
        [9, 'out'],
      ]
    )
  })

  /**
   * The dry run is what answers the requirement literally — "the system says to
   * take lot 4, 5, 8". It must therefore consume nothing at all.
   */
  test('dryRun returns the plan and writes nothing', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 5)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .loginAs(user)
      .json({ productId: recipe.id, quantity: 15, dryRun: true })

    response.assertStatus(200)
    const [line] = response.body().data.lines
    assert.equal(line.picks[0].label, 'L26-1')
    assert.equal(line.picks[0].take_qty, 15)
    // Scoped to this test's own rows: the development database is seeded and
    // the global transaction does not remove what was already there.
    assert.equal(await countOf(ProductionRun.query().where('eventId', event.id)), 0)
    assert.equal(await countOf(StockMovement.query().where('goodId', good.id)), 0)
  })

  /**
   * A partial pick would leave goods out of the stock with no product made
   * against them, so a shortfall on ONE good refuses the whole run.
   */
  test('refuses the whole run when one good is short', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const sausage = await makeGood('Saucisses')
    const bread = await makeGood('Pains')
    await batch(sausage, 'S-1', 500, 30)
    await batch(bread, 'P-1', 10, 30)
    const recipe = await makeRecipe('Hot-dog', [
      [sausage, 1],
      [bread, 1],
    ])

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .loginAs(user)
      .json({ productId: recipe.id, quantity: 100 })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_STOCK_INSUFFICIENT')
    assert.include(response.body().error.message, 'Pains')
    // Nothing was taken from the good that WAS sufficient — the refusal is
    // atomic, not per-good.
    assert.equal(await countOf(StockMovement.query().where('goodId', sausage.id)), 0)
    assert.equal(await countOf(ProductionRun.query().where('eventId', event.id)), 0)
  })

  test('refuses a member without stock:update', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 5)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .loginAs(user)
      .json({ productId: recipe.id, quantity: 1 })

    response.assertStatus(403)
  })

  test('refuses a quantity that is not a positive integer', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 5)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const response = await client
      .post(`/v1/events/${event.id}/production-runs`)
      .loginAs(user)
      .json({ productId: recipe.id, quantity: 0 })

    response.assertStatus(400)
    assert.equal(response.body().error.code, 'E_BAD_REQUEST')
  })
})

test.group('Production runs — lecture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('aggregates produced quantity against the planned menu quantity', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 200, price: 250 } })
    await ProductionRun.create({
      eventId: event.id,
      productId: recipe.id,
      quantity: 80,
      memberId: member.id,
    })
    await ProductionRun.create({
      eventId: event.id,
      productId: recipe.id,
      quantity: 40,
      memberId: member.id,
    })

    const response = await client.get(`/v1/events/${event.id}/production-runs`).loginAs(user)

    response.assertStatus(200)
    const [line] = response.body().data
    assert.equal(line.product_id, recipe.id)
    assert.equal(line.planned_qty, 200)
    assert.equal(line.produced_qty, 120)
    assert.lengthOf(line.runs, 2)
  })

  /**
   * A run is a fact. Taking the recipe off the menu does not undo the food that
   * was made, so its line survives with a planned quantity of zero.
   */
  test('keeps a line for a recipe produced but no longer on the menu', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])
    await ProductionRun.create({
      eventId: event.id,
      productId: recipe.id,
      quantity: 50,
      memberId: member.id,
    })

    const response = await client.get(`/v1/events/${event.id}/production-runs`).loginAs(user)

    response.assertStatus(200)
    const [line] = response.body().data
    assert.equal(line.planned_qty, 0)
    assert.equal(line.produced_qty, 50)
    assert.equal(line.product_name, 'Hot-dog')
  })

  test('refuses a member without stock:read', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])
    const event = await makeEvent()

    const response = await client.get(`/v1/events/${event.id}/production-runs`).loginAs(user)

    response.assertStatus(403)
  })
})
