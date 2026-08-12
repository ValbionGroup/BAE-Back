import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { pdfService } from '#services/pdf_service'

test.group('Étiquettes de lot PDF', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF for the requested batch ids', async ({ client, assert }) => {
    const good = await Good.create({ name: 'Saucisses', unit: 'pcs', brand: 'Marque', categoryId: null })
    const batch = await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '24',
      expirationDate: DateTime.now().plus({ days: 10 }),
    })
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get(`/v1/stock-batches/labels/pdf?ids=${batch.id}`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
    assert.equal(Buffer.from(response.body()).subarray(0, 4).toString('latin1'), '%PDF')
  }).timeout(20_000)

  test('without ids, prints every batch with remaining stock, capped at 12', async ({
    client,
    assert,
  }) => {
    const good = await Good.create({ name: 'Saucisses', unit: 'pcs', brand: 'Marque', categoryId: null })
    await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '24',
      expirationDate: DateTime.now().plus({ days: 10 }),
    })
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get('/v1/stock-batches/labels/pdf').loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)

  test('refuses a member without stock:read', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get('/v1/stock-batches/labels/pdf').loginAs(user)

    response.assertStatus(403)
  })
})
