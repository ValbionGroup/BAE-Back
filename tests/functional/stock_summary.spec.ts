import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { GoodFactory } from '#database/factories/good_factory'
import { StockBatchFactory } from '#database/factories/stock_batch_factory'
import { StockMovementFactory } from '#database/factories/stock_movement_factory'

test.group('Stock summary and discard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('computes remaining quantity from OUT movements', async ({ client }) => {
    const user = await UserFactory.create()
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
    const user = await UserFactory.create()
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
})
