import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { loadFullInventory } from '#services/stock_service'
import { pdfService } from '#services/pdf_service'

test.group('loadFullInventory', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('groups non-empty batches by category and good', async ({ assert }) => {
    const category = await Category.create({ name: 'Frais' })
    const good = await Good.create({
      name: 'Saucisses',
      unit: 'pcs',
      brand: 'Marque',
      categoryId: category.id,
    })
    await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '14',
      expirationDate: DateTime.now().plus({ days: 5 }),
    })
    await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L25-91',
      quantity: '2',
      expirationDate: DateTime.now().minus({ days: 1 }),
    })

    const rows = await loadFullInventory()
    const row = rows.find((r) => r.goodName === 'Saucisses')!

    assert.equal(row.categoryName, 'Frais')
    assert.lengthOf(row.batches, 2)
  })
})

test.group('Inventaire PDF — endpoint', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF to a member holding stock:read', async ({ client, assert }) => {
    const good = await Good.create({ name: 'Saucisses', unit: 'pcs', brand: 'Marque', categoryId: null })
    await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '14',
      expirationDate: DateTime.now().plus({ days: 5 }),
    })
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get('/v1/stock-batches/inventory/pdf').loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)

  test('refuses a member without stock:read', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get('/v1/stock-batches/inventory/pdf').loginAs(user)

    response.assertStatus(403)
  })
})
