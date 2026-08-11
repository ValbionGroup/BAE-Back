import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import Product from '#models/product'
import StockBatch from '#models/stock_batch'
import { planProduction } from '#services/production_service'

async function makeGood(name: string, unit = 'pcs') {
  return Good.create({ name, unit, brand: 'Marque', categoryId: null })
}

async function batch(good: Good, label: string, quantity: number, daysToDlc: number | null) {
  return StockBatch.create({
    goodId: good.id,
    restockId: null,
    label,
    quantity: String(quantity),
    expirationDate: daysToDlc === null ? null : DateTime.now().plus({ days: daysToDlc }),
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

test.group('Production — plan FEFO', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('takes the nearest expiry first', async ({ assert }) => {
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-LOIN', 100, 90)
    await batch(good, 'L26-PROCHE', 100, 5)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const { lines, shortfalls } = await planProduction(recipe.id, 10)

    assert.lengthOf(shortfalls, 0)
    assert.lengthOf(lines[0].picks, 1)
    assert.equal(lines[0].picks[0].label, 'L26-PROCHE')
    assert.equal(lines[0].picks[0].takeQty, 10)
  })

  /**
   * FEFO exists to avoid waste, not to serve out-of-date food. An expired batch
   * leaves the stock through `discard`, which already exists — it is never
   * something the system proposes to cook with.
   */
  test('never proposes an expired batch', async ({ assert }) => {
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-PERIME', 100, -3)
    await batch(good, 'L26-BON', 100, 30)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const { lines } = await planProduction(recipe.id, 10)

    assert.lengthOf(lines[0].picks, 1)
    assert.equal(lines[0].picks[0].label, 'L26-BON')
  })

  /**
   * Postgres sorts NULLS LAST on an ascending order by default. That is engine
   * behaviour, not our code — another database would silently reverse it, so it
   * gets a test of its own.
   */
  test('puts a batch without a DLC last', async ({ assert }) => {
    const good = await makeGood('Sel')
    await batch(good, 'L26-SANS-DLC', 100, null)
    await batch(good, 'L26-AVEC-DLC', 100, 60)
    const recipe = await makeRecipe('Frites', [[good, 1]])

    const { lines } = await planProduction(recipe.id, 10)

    assert.equal(lines[0].picks[0].label, 'L26-AVEC-DLC')
  })

  test('spreads the pick across several batches', async ({ assert }) => {
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 6, 5)
    await batch(good, 'L26-2', 12, 10)
    await batch(good, 'L26-3', 12, 20)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const { lines } = await planProduction(recipe.id, 25)

    assert.deepEqual(
      lines[0].picks.map((p) => [p.label, p.takeQty]),
      [
        ['L26-1', 6],
        ['L26-2', 12],
        ['L26-3', 7],
      ]
    )
  })

  test('multiplies the need by the recipe quantity', async ({ assert }) => {
    const sausage = await makeGood('Saucisses')
    const bread = await makeGood('Pains')
    await batch(sausage, 'S-1', 500, 30)
    await batch(bread, 'P-1', 500, 30)
    const recipe = await makeRecipe('Hot-dog', [
      [sausage, 2],
      [bread, 1],
    ])

    const { lines } = await planProduction(recipe.id, 100)

    const bySausage = lines.find((l) => l.goodId === sausage.id)!
    const byBread = lines.find((l) => l.goodId === bread.id)!
    assert.equal(bySausage.needQty, 200)
    assert.equal(byBread.needQty, 100)
  })

  test('reports a shortfall instead of picking what it can', async ({ assert }) => {
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 30, 10)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])

    const { shortfalls } = await planProduction(recipe.id, 50)

    assert.lengthOf(shortfalls, 1)
    assert.deepInclude(shortfalls[0], { needQty: 50, availableQty: 30, missingQty: 20 })
  })
})
