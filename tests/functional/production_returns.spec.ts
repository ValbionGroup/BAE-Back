import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import StockBatch from '#models/stock_batch'
import { commitProduction } from '#services/production_service'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeEvent() {
  return Event.create({
    name: 'Soirée test',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4,
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

async function makeRecipe(good: Good) {
  const product = await Product.create({
    name: 'Hot-dog',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  await product.related('goods').attach({ [good.id]: { quantity: 1, rank: 1, instruction: null } })
  return product
}

test.group('Production returns', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * Last taken, first given back. The short-DLC batches were opened and started
   * first, so what comes back is what was not touched.
   */
  test('credits the batches in reverse order of the pick', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    const near = await batch(good, 'L26-PROCHE', 6, 5)
    const far = await batch(good, 'L26-LOIN', 20, 40)
    const recipe = await makeRecipe(good)

    // Takes 6 from the near batch, then 9 from the far one.
    await commitProduction(event.id, recipe.id, 15, member.id)

    const response = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 4 }] })

    response.assertStatus(200)

    const batches = await loadBatchesWithRemaining(good.id, true)
    const byId = new Map(batches.map((b) => [b.id, b.remainingQty]))
    // The far batch went 20 → 11 at the pick, and comes back to 15.
    assert.equal(byId.get(far.id), 15)
    // The near one stays empty: it was the first taken, so the last given back.
    assert.equal(byId.get(near.id), 0)
  })

  test('refuses to return more than the evening took', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 30)
    const recipe = await makeRecipe(good)
    await commitProduction(event.id, recipe.id, 10, member.id)

    const response = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 11 }] })

    response.assertStatus(400)
    assert.equal(response.body().error.code, 'E_RETURN_EXCEEDS_PICKED')
  })

  test('a second return cannot exceed what is left to give back', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await batch(good, 'L26-1', 50, 30)
    const recipe = await makeRecipe(good)
    await commitProduction(event.id, recipe.id, 10, member.id)

    const first = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 6 }] })
    first.assertStatus(200)

    const response = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 5 }] })

    response.assertStatus(400)
    assert.equal(response.body().error.code, 'E_RETURN_EXCEEDS_PICKED')
  })

  /**
   * The return spans the EVENING, not one run: an operator counts what is left
   * on the bench, not run by run.
   */
  test('spans every run of the evening', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:update'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    const only = await batch(good, 'L26-1', 50, 30)
    const recipe = await makeRecipe(good)
    await commitProduction(event.id, recipe.id, 10, member.id)
    await commitProduction(event.id, recipe.id, 10, member.id)

    const response = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 15 }] })

    response.assertStatus(200)
    const batches = await loadBatchesWithRemaining(good.id, true)
    // 50 − 20 taken + 15 returned.
    assert.equal(batches.find((b) => b.id === only.id)!.remainingQty, 45)
  })

  test('refuses a member without stock:update', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])
    const event = await makeEvent()
    const good = await makeGood('Saucisses')

    const response = await client
      .post(`/v1/events/${event.id}/production-returns`)
      .loginAs(user)
      .json({ lines: [{ goodId: good.id, quantity: 1 }] })

    response.assertStatus(403)
  })
})
