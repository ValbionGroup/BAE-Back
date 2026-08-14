import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { GoodFactory } from '#database/factories/good_factory'
import { StockBatchFactory } from '#database/factories/stock_batch_factory'
import { StockMovementFactory } from '#database/factories/stock_movement_factory'

test.group('Stock summary and discard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function asStockManager() {
    const member = await MemberFactory.create()
    return grantPermissions(member, ['stock:read', 'stock:write'])
  }

  test('computes remaining quantity from OUT movements', async ({ client }) => {
    const user = await asStockManager()
    const good = await GoodFactory.create()
    const batch = await StockBatchFactory.merge({
      goodId: good.id,
      quantity: '10',
      restockId: null,
    }).create()
    await StockMovementFactory.merge({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '3',
      movementType: 'out',
    }).create()

    const summary = await client.get('/v1/stocks').loginAs(user)
    summary.assertStatus(200)
    summary.assertBodyContains({ data: [{ id: good.id, total_remaining_qty: 7, batch_count: 1 }] })
  })

  test('discard writes off the remaining quantity of a batch', async ({ client }) => {
    const user = await asStockManager()
    const good = await GoodFactory.create()
    const batch = await StockBatchFactory.merge({
      goodId: good.id,
      quantity: '10',
      restockId: null,
    }).create()

    const discard = await client
      .post(`/v1/stocks/${good.id}/batches/${batch.id}/discard`)
      .loginAs(user)
    discard.assertStatus(204)

    const batches = await client
      .get(`/v1/stocks/${good.id}/batches`)
      .qs({ showEmpty: false })
      .loginAs(user)
    batches.assertBody({ data: [] })
  })

  /**
   * `movement_type` has allowed 'in' since the very first migration, but no
   * application code ever wrote one and both derivations of the remaining
   * quantity filtered them out. A production return written as an 'in' movement
   * would have been perfectly recorded and perfectly without effect.
   */
  test('credits an IN movement back onto the batch', async ({ client, assert }) => {
    const user = await asStockManager()
    const good = await GoodFactory.create()
    const batch = await StockBatchFactory.merge({
      goodId: good.id,
      quantity: '100',
      restockId: null,
    }).create()
    await StockMovementFactory.merge({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '40',
      movementType: 'out',
    }).create()
    await StockMovementFactory.merge({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '15',
      movementType: 'in',
    }).create()

    const summary = await client.get('/v1/stocks').loginAs(user)
    summary.assertStatus(200)
    // Looked up by id, not by position: `GET /stocks` orders by name and
    // GoodFactory draws a random one, so the row's index is not stable.
    const row = summary.body().data.find((item: { id: number }) => item.id === good.id)
    assert.equal(row.total_remaining_qty, 75)
  })

  test('an IN movement does not mark the batch as opened', async ({ client, assert }) => {
    const user = await asStockManager()
    const good = await GoodFactory.create()
    const batch = await StockBatchFactory.merge({
      goodId: good.id,
      quantity: '50',
      restockId: null,
    }).create()
    await StockMovementFactory.merge({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '10',
      movementType: 'in',
    }).create()

    const batches = await client.get(`/v1/stocks/${good.id}/batches`).loginAs(user)
    batches.assertStatus(200)
    // A return does not un-open a packet: `openedAt` only ever looks at OUT.
    assert.isNull(batches.body().data[0].opened_at)
  })

  /**
   * `stock_batches.label` has existed since the very first migration and
   * `nextLabel()` already produced `L26-4`, but `BatchWithRemaining` did not
   * carry it: the number existed in the database and was visible nowhere.
   * "Take lot number 4" needs the human-readable number, not the primary key.
   */
  test('exposes the human-readable lot number', async ({ client, assert }) => {
    const user = await asStockManager()
    const good = await GoodFactory.create()
    await StockBatchFactory.merge({
      goodId: good.id,
      quantity: '10',
      restockId: null,
      label: 'L26-4',
    }).create()

    const batches = await client.get(`/v1/stocks/${good.id}/batches`).loginAs(user)

    batches.assertStatus(200)
    assert.equal(batches.body().data[0].label, 'L26-4')
  })
})
