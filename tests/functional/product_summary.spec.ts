import { test } from '@japa/runner'
import ProductCategory from '#models/product_category'
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

  /**
   * ⚠️ **La règle a changé le 2026-08-26.** La catégorie était dérivée de
   * l'ingrédient de plus faible `rank` ; elle est désormais portée par la
   * recette. Les catégories de denrées classent le **stockage**, celle de la
   * recette classe la **vente** — le test le montre en donnant à l'ingrédient
   * une catégorie que le résumé ne doit surtout pas reprendre.
   */
  test('labels a product with the category the product carries', async ({ client, assert }) => {
    const user = await asProductReader()
    const category = await ProductCategory.create({ name: 'Desserts' })
    const product = await ProductFactory.merge({ productCategoryId: category.id }).create()

    const goodCategory = await CategoryFactory.merge({ name: 'Frais' }).create()
    const mainGood = await GoodFactory.merge({ categoryId: goodCategory.id }).create()
    const sideGood = await GoodFactory.create()

    await product.related('goods').attach({
      [sideGood.id]: { quantity: 1, rank: 2, instruction: null },
      [mainGood.id]: { quantity: 1, rank: 1, instruction: null },
    })

    const response = await client.get('/v1/products/summary').loginAs(user)

    response.assertStatus(200)
    const row = response.body().data.find((p: { id: number }) => p.id === product.id)
    assert.equal(row.category, 'Desserts')
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
