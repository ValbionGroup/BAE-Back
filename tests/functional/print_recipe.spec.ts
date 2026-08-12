import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Good from '#models/good'
import Product from '#models/product'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { pdfService } from '#services/pdf_service'

test.group('Fiche recette PDF', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF to a member holding product:read', async ({ client, assert }) => {
    const good = await Good.create({ name: 'Saucisse', unit: 'pcs', brand: 'Marque', categoryId: null })
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await recipe
      .related('goods')
      .attach({ [good.id]: { quantity: 1, rank: 1, instruction: 'Griller 4 min.' } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['product:read'])

    const response = await client.get(`/v1/products/${recipe.id}/recipe/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
    assert.equal(Buffer.from(response.body()).subarray(0, 4).toString('latin1'), '%PDF')
  }).timeout(20_000)

  test("scales quantities to the event's planned quantity when eventId is given", async ({
    client,
    assert,
  }) => {
    const good = await Good.create({ name: 'Saucisse', unit: 'pcs', brand: 'Marque', categoryId: null })
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await recipe.related('goods').attach({ [good.id]: { quantity: 1, rank: 1, instruction: null } })
    const event = await Event.create({
      name: 'Soirée',
      description: null,
      date: DateTime.fromISO('2026-02-14'),
      status: 'scheduled',
      duration: 4,
    })
    await event.related('products').attach({ [recipe.id]: { quantity: 50, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['product:read'])

    const response = await client
      .get(`/v1/products/${recipe.id}/recipe/pdf?eventId=${event.id}`)
      .loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
  }).timeout(20_000)

  test('refuses a member without product:read', async ({ client }) => {
    const recipe = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get(`/v1/products/${recipe.id}/recipe/pdf`).loginAs(user)

    response.assertStatus(403)
  })
})
