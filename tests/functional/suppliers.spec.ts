import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { SupplierFactory } from '#database/factories/supplier_factory'

test.group('Suppliers listing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists suppliers by name, without their goods or restocks', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['supplier:read'])
    await SupplierFactory.merge({ name: 'Zzz Leclerc' }).create()
    await SupplierFactory.merge({ name: 'Aaa Carrefour' }).create()

    const response = await client.get('/v1/suppliers').loginAs(user)
    response.assertStatus(200)

    const rows: Array<Record<string, unknown>> = response.body().data
    const mine = rows.filter((s) => s.name === 'Zzz Leclerc' || s.name === 'Aaa Carrefour')

    assert.deepEqual(
      mine.map((s) => s.name),
      ['Aaa Carrefour', 'Zzz Leclerc']
    )
    assert.notProperty(mine[0], 'goods')
    assert.notProperty(mine[0], 'restocks')
    assert.property(mine[0], 'id')
  })
})
