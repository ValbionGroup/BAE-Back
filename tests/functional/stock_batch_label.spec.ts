import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import { UserFactory } from '#database/factories/user_factory'

test.group('Stock batch label', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeGood() {
    return Good.create({ name: 'Sauce ZZ', unit: 'pcs', brand: '', categoryId: null })
  }

  test('generates a readable label when none is given', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const good = await makeGood()

    const response = await client
      .post('/v1/stock-batches')
      .json({ good_id: good.id, quantity: 3, expiration_date: null })
      .loginAs(user)

    response.assertStatus(200)
    assert.match(response.body().data.label, /^L\d{2}-1$/)
  })

  test('numbers the batches of one good in sequence', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const good = await makeGood()

    await client.post('/v1/stock-batches').json({ good_id: good.id, quantity: 1 }).loginAs(user)
    const second = await client
      .post('/v1/stock-batches')
      .json({ good_id: good.id, quantity: 1 })
      .loginAs(user)

    assert.match(second.body().data.label, /^L\d{2}-2$/)
  })

  test('counts per good, not globally', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const first = await makeGood()
    const other = await Good.create({
      name: 'Autre ZZ',
      unit: 'pcs',
      brand: '',
      categoryId: null,
    })

    await client.post('/v1/stock-batches').json({ good_id: first.id, quantity: 1 }).loginAs(user)
    const response = await client
      .post('/v1/stock-batches')
      .json({ good_id: other.id, quantity: 1 })
      .loginAs(user)

    assert.match(response.body().data.label, /^L\d{2}-1$/)
  })

  test('keeps a label the caller provides', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const good = await makeGood()

    const response = await client
      .post('/v1/stock-batches')
      .json({ good_id: good.id, quantity: 1, label: 'PALETTE-A' })
      .loginAs(user)

    assert.equal(response.body().data.label, 'PALETTE-A')
  })

  test('persists the quantity it was given', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const good = await makeGood()

    const response = await client
      .post('/v1/stock-batches')
      .json({ good_id: good.id, quantity: 7 })
      .loginAs(user)

    const batch = await StockBatch.findOrFail(response.body().data.id)
    assert.equal(batch.quantity, 7)
  })
})
