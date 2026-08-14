import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { GoodFactory } from '#database/factories/good_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'

test.group('Goods supplier pricing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exposes every supplier price, cheapest first', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['good:read'])
    const good = await GoodFactory.create()
    const cheap = await SupplierFactory.merge({ name: 'Leclerc' }).create()
    const dear = await SupplierFactory.merge({ name: 'Carrefour' }).create()

    await good.related('suppliers').attach({
      [dear.id]: { price: 5.4 },
      [cheap.id]: { price: 4.95 },
    })

    const response = await client.get('/v1/goods').loginAs(user)
    response.assertStatus(200)

    const row = response.body().data.find((g: { id: number }) => g.id === good.id)
    assert.deepEqual(
      row.suppliers.map((s: { name: string }) => s.name),
      ['Leclerc', 'Carrefour']
    )
    assert.strictEqual(row.suppliers[0].price, 4.95)
    assert.strictEqual(row.best_price, 4.95)
    assert.equal(row.best_supplier.name, 'Leclerc')
  })

  test('reports no price for a good nobody supplies', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['good:read'])
    const good = await GoodFactory.create()

    const response = await client.get('/v1/goods').loginAs(user)
    response.assertStatus(200)

    const row = response.body().data.find((g: { id: number }) => g.id === good.id)
    assert.deepEqual(row.suppliers, [])
    assert.isNull(row.best_price)
    assert.isNull(row.best_supplier)
  })
})
