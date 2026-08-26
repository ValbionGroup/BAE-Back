import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Stock movement validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeGood(name = 'Sauce ZZ') {
    return Good.create({ name, unit: 'pcs', brand: '', categoryId: null })
  }

  async function makeBatch(goodId: number, quantity = 10) {
    // `quantity` est une colonne `decimal` : le driver la rend en string, le
    // modèle la veut en string.
    return StockBatch.create({
      goodId,
      quantity: String(quantity),
      label: 'L26-1',
      expirationDate: null,
    })
  }

  async function asStockManager() {
    const member = await MemberFactory.create()
    return grantPermissions(member, ['stock:read', 'stock:write'])
  }

  test('refuses a negative quantity', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: -5,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('refuses a movement type outside in and out', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 1,
        movement_type: 'discard',
      })
      .loginAs(user)

    // La colonne est un enum en base : sans validateur, c'est la contrainte
    // Postgres qui tranche, en 500.
    response.assertStatus(422)
  })

  /**
   * Le cas qui perdait du stock en silence : le mouvement s'écrivait sur le lot
   * demandé, mais était compté dans le total de `good_id` — deux denrées
   * fausses d'un coup.
   */
  test('refuses a batch that belongs to another good', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const other = await makeGood('Autre ZZ')
    const batch = await makeBatch(other.id)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 1,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_BATCH_MISMATCH' } })
  })

  test('refuses taking more than the batch still holds', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 4)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 5,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_STOCK_INSUFFICIENT' } })
  })

  test('counts what earlier movements already took', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 10)
    await StockMovement.create({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '7',
      movementType: 'out',
    })

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 4,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_STOCK_INSUFFICIENT' } })
  })

  test('records an out movement and lowers what the batch holds', async ({ client, assert }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 10)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 3,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(200)

    const batches = await client.get(`/v1/stocks/${good.id}/batches`).loginAs(user)
    const row = batches.body().data.find((b: { id: number }) => b.id === batch.id)
    assert.equal(Number(row.remaining_qty), 7)
  })

  /** Une entrée n'a rien à vérifier contre le restant : elle l'augmente. */
  test('lets an in movement pass whatever the batch holds', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 1)

    const response = await client
      .post('/v1/stock-movements')
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 50,
        movement_type: 'in',
      })
      .loginAs(user)

    response.assertStatus(200)
  })

  /**
   * `update` porte le même trou que `store` : il fusionnait `request.all()`.
   * Un mouvement corrigé est le geste d'un trésorier qui se relit, pas une
   * porte dérobée vers un stock négatif.
   */
  test('refuses an update that would take more than the batch holds', async ({ client }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 10)
    const movement = await StockMovement.create({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '3',
      movementType: 'out',
    })

    const response = await client
      .put(`/v1/stock-movements/${movement.id}`)
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 12,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_STOCK_INSUFFICIENT' } })
  })

  /** Sa propre quantité ne se compte pas contre lui : sinon corriger 3 en 8
   *  sur un lot de 10 serait refusé alors que le lot les porte. */
  test('lets an update grow within what the batch holds', async ({ client, assert }) => {
    const user = await asStockManager()
    const good = await makeGood()
    const batch = await makeBatch(good.id, 10)
    const movement = await StockMovement.create({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '3',
      movementType: 'out',
    })

    const response = await client
      .put(`/v1/stock-movements/${movement.id}`)
      .json({
        good_id: good.id,
        stock_batch_id: batch.id,
        quantity: 8,
        movement_type: 'out',
      })
      .loginAs(user)

    response.assertStatus(200)

    const batches = await client.get(`/v1/stocks/${good.id}/batches`).loginAs(user)
    const row = batches.body().data.find((b: { id: number }) => b.id === batch.id)
    assert.equal(Number(row.remaining_qty), 2)
  })
})
