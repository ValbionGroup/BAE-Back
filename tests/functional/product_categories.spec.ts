import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

function cuisinier() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['product:read', 'product:write', 'product:delete'])
  )
}

async function recipeNamed(name: string, categoryId: number | null = null) {
  const product = new Product()
  product.name = name
  product.isVegetarian = false
  product.description = null
  product.recipe = null
  product.productCategoryId = categoryId
  await product.save()
  return product
}

test.group('Catégories de recettes — CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuse une catégorie sans nom', async ({ client }) => {
    const user = await cuisinier()
    const response = await client.post('/v1/product-categories').json({ name: ' ' }).loginAs(user)
    response.assertStatus(422)
  })

  test('crée une catégorie en rognant les espaces', async ({ client, assert }) => {
    const user = await cuisinier()
    const response = await client
      .post('/v1/product-categories')
      .json({ name: '  Desserts  ' })
      .loginAs(user)

    response.assertStatus(200)
    const created = await ProductCategory.findByOrFail('name', 'Desserts')
    assert.equal(created.name, 'Desserts')
  })

  test('compte les recettes classées dans chaque catégorie', async ({ client, assert }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'Plats de vérification' })
    await recipeNamed('Hot-dog de vérification', category.id)

    const response = await client.get('/v1/product-categories').loginAs(user)
    response.assertStatus(200)

    const row = (response.body().data as { id: number; products_count: number }[]).find(
      (entry) => entry.id === category.id
    )
    assert.equal(row?.products_count, 1)
  })

  /**
   * ⚠️ **L'assertion qui compte, et la différence assumée avec les enseignes.**
   * `products.product_category_id` est en `SET NULL` : supprimer une catégorie
   * **déclasse** les recettes, elle n'en perd aucune. Refuser en 409 serait une
   * rigidité sans contrepartie.
   */
  test('supprimer une catégorie déclasse ses recettes sans les détruire', async ({
    client,
    assert,
  }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'À supprimer' })
    const recipe = await recipeNamed('Crêpe de vérification', category.id)

    const response = await client.delete(`/v1/product-categories/${category.id}`).loginAs(user)

    response.assertStatus(204)
    const reloaded = await Product.findOrFail(recipe.id)
    assert.isNull(reloaded.productCategoryId)
    assert.equal(reloaded.name, 'Crêpe de vérification')
  })

  test('refuse l’écriture à qui n’a pas product:write', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['product:read'])

    const response = await client
      .post('/v1/product-categories')
      .json({ name: 'Interdite' })
      .loginAs(user)
    response.assertStatus(403)
  })
})
