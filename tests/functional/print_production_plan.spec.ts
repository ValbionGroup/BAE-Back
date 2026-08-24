import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import StockBatch from '#models/stock_batch'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { planProductionForEvent } from '#services/production_service'
import { pdfService } from '#services/pdf_service'

async function makeEvent(name = 'Soirée Hivernale') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4 * 60 * 60,
  })
}

async function makeGood(name: string) {
  return Good.create({ name, unit: 'pcs', brand: 'Marque', categoryId: null })
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

test.group('planProductionForEvent — agrégation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('two recipes sharing a good do not each plan against the same untouched batch', async ({
    assert,
  }) => {
    const event = await makeEvent()
    const bun = await makeGood('Pain')
    await batch(bun, 'L26-1', 150, 30)
    const hotdog = await makeRecipe('Hot-dog', [[bun, 1]])
    const veggie = await makeRecipe('Hot-dog veggie', [[bun, 1]])
    await event.related('products').attach({
      [hotdog.id]: { quantity: 100, price: 0 },
      [veggie.id]: { quantity: 40, price: 0 },
    })

    const { lines } = await planProductionForEvent(event.id)
    const bunLine = lines.find((line) => line.goodId === bun.id)!

    // 100 + 40 = 140 needed from ONE batch of 150 — a naive per-recipe loop
    // would instead see 150 available twice and never report the shortfall a
    // shared-batch scenario with only 120 in stock would actually have.
    assert.equal(bunLine.needQty, 140)
    assert.equal(bunLine.picks[0].takeQty, 140)
    assert.equal(bunLine.availableQty, 150)
  })
})

test.group('Plan FEFO PDF — endpoint', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF to a member holding stock:read', async ({ client, assert }) => {
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 5)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get(`/v1/events/${event.id}/production-plan/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
    assert.equal(Buffer.from(response.body()).subarray(0, 4).toString('latin1'), '%PDF')
  }).timeout(20_000)

  test('refuses a member without stock:read', async ({ client }) => {
    const event = await makeEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get(`/v1/events/${event.id}/production-plan/pdf`).loginAs(user)

    response.assertStatus(403)
  })
})
