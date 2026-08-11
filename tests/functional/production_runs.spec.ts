import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Product from '#models/product'
import ProductionRun from '#models/production_run'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeEvent(name = 'Soirée test') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })
}

test.group('Production runs — cycle de vie', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses to delete a recipe that has already been produced', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['product:delete'])
    const event = await makeEvent()
    const product = await Product.create({
      name: 'Hot-dog',
      isVegetarian: false,
      description: null,
      recipe: null,
    })
    await ProductionRun.create({
      eventId: event.id,
      productId: product.id,
      quantity: 200,
      memberId: member.id,
    })

    const response = await client.delete(`/v1/products/${product.id}`).loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PRODUCT_IN_USE')
    assert.include(response.body().error.message, 'production')
  })
})
