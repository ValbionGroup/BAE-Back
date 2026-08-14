import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { ProductFactory } from '#database/factories/product_factory'
import { GoodFactory } from '#database/factories/good_factory'
import { CategoryFactory } from '#database/factories/category_factory'

test.group('Product summary', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function asProductReader() {
    const member = await MemberFactory.create()
    return grantPermissions(member, ['product:read'])
  }

  test('is reachable and not shadowed by products/:id', async ({ client }) => {
    const user = await asProductReader()
    const product = await ProductFactory.create()

    const response = await client.get('/v1/products/summary').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: [{ id: product.id, name: product.name }] })
  })

  test('labels a product with its lowest-rank ingredient category', async ({ client, assert }) => {
    const user = await asProductReader()
    const product = await ProductFactory.create()

    const mainCategory = await CategoryFactory.merge({ name: 'Boisson' }).create()
    const sideCategory = await CategoryFactory.merge({ name: 'Dessert' }).create()
    const mainGood = await GoodFactory.merge({ categoryId: mainCategory.id }).create()
    const sideGood = await GoodFactory.merge({ categoryId: sideCategory.id }).create()

    await product.related('goods').attach({
      [sideGood.id]: { quantity: 1, rank: 2, instruction: null },
      [mainGood.id]: { quantity: 1, rank: 1, instruction: null },
    })

    const response = await client.get('/v1/products/summary').loginAs(user)

    response.assertStatus(200)
    const row = response.body().data.find((p: { id: number }) => p.id === product.id)
    assert.equal(row.category, 'Boisson')
    assert.equal(row.ingredient_count, 2)
  })

  test('returns a null category for a product with no ingredients', async ({ client, assert }) => {
    const user = await asProductReader()
    const product = await ProductFactory.create()

    const response = await client.get('/v1/products/summary').loginAs(user)

    response.assertStatus(200)
    const row = response.body().data.find((p: { id: number }) => p.id === product.id)
    assert.isNull(row.category)
  })
})
