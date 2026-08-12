import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import ProductionRun from '#models/production_run'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { pdfService } from '#services/pdf_service'

async function makeEvent(name = 'Soirée') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })
}

test.group('Feuille de clôture PDF', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF to a member holding stock:read, even with nothing produced', async ({
    client,
    assert,
  }) => {
    const event = await makeEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get(`/v1/events/${event.id}/production-returns/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)

  test('serves a PDF with a produced good listed', async ({ client, assert }) => {
    const event = await makeEvent()
    const good = await Good.create({ name: 'Saucisses', unit: 'pcs', brand: 'Marque', categoryId: null })
    const batch = await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '50',
      expirationDate: DateTime.now().plus({ days: 10 }),
    })
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    const member = await MemberFactory.create()
    const run = await ProductionRun.create({
      eventId: event.id,
      productId: recipe.id,
      quantity: 20,
      memberId: member.id,
    })
    await StockMovement.create({
      goodId: good.id,
      stockBatchId: batch.id,
      quantity: '20',
      movementType: 'out',
      productionRunId: run.id,
    })
    const user = await grantPermissions(member, ['stock:read'])

    const response = await client.get(`/v1/events/${event.id}/production-returns/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)

  test('refuses a member without stock:read', async ({ client }) => {
    const event = await makeEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get(`/v1/events/${event.id}/production-returns/pdf`).loginAs(user)

    response.assertStatus(403)
  })
})
