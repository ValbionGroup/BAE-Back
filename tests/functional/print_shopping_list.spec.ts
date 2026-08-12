import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import Supplier from '#models/supplier'
import StockBatch from '#models/stock_batch'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { pdfService } from '#services/pdf_service'

async function makeEvent(name = 'Soirée Hivernale') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })
}

test.group('Fiche logistique PDF', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF to a member holding menu:read and stock:read', async ({
    client,
    assert,
  }) => {
    const event = await makeEvent()
    const good = await Good.create({ name: 'Pain', unit: 'pcs', brand: 'Marque', categoryId: null })
    const leclerc = await Supplier.create({ name: 'Leclerc' })
    await leclerc.related('goods').attach({ [good.id]: { price: 2 } })
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await recipe.related('goods').attach({ [good.id]: { quantity: 1, rank: 1, instruction: null } })
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'stock:read'])

    const response = await client.get(`/v1/events/${event.id}/shopping-list/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
    assert.isAbove(Number(response.header('content-length')), 1000)
  }).timeout(20_000)

  test('refuses a member holding menu:read but not stock:read', async ({ client, assert }) => {
    const event = await makeEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/shopping-list/pdf`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })

  test('an event name with special characters does not break the PDF', async ({
    client,
    assert,
  }) => {
    const event = await makeEvent('Soirée <BBQ> & Cie')
    const good = await Good.create({ name: 'Pain', unit: 'pcs', brand: 'Marque', categoryId: null })
    await StockBatch.create({
      goodId: good.id,
      restockId: null,
      label: 'L26-1',
      quantity: '1',
      expirationDate: DateTime.now().plus({ days: 10 }),
    })
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await recipe.related('goods').attach({ [good.id]: { quantity: 5, rank: 1, instruction: null } })
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'stock:read'])

    const response = await client.get(`/v1/events/${event.id}/shopping-list/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)
})
