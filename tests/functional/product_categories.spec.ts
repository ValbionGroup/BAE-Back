import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { EventFactory } from '#database/factories/event_factory'
import Good from '#models/good'
import Category from '#models/category'

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

test.group('Catégories de recettes — ce que l’API expose', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('le résumé des recettes rend la catégorie propre', async ({ client, assert }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'Desserts de vérification' })
    const recipe = await recipeNamed('Crêpe de vérification', category.id)

    const response = await client.get('/v1/products/summary').loginAs(user)
    response.assertStatus(200)

    const row = (response.body().data as { id: number; category: string | null }[]).find(
      (entry) => entry.id === recipe.id
    )
    assert.equal(row?.category, 'Desserts de vérification')
  })

  test('une recette non classée rend null, et non une chaîne vide', async ({ client, assert }) => {
    const user = await cuisinier()
    const recipe = await recipeNamed('Sans catégorie de vérification')

    const response = await client.get('/v1/products/summary').loginAs(user)

    const row = (response.body().data as { id: number; category: string | null }[]).find(
      (entry) => entry.id === recipe.id
    )
    assert.isNull(row?.category)
  })

  /**
   * ⚠️ Le menu de soirée est l'endpoint que lit la **caisse** : ses onglets en
   * dérivent. C'est ici que la bascule se voit à l'écran.
   */
  test('le menu d’une soirée rend la catégorie propre', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'stock:read'])
    const category = await ProductCategory.create({ name: 'Plats de vérification' })
    const recipe = await recipeNamed('Hot-dog de vérification', category.id)
    const event = await EventFactory.create()
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 350 } })

    const response = await client.get(`/v1/events/${event.id}/products`).loginAs(user)
    response.assertStatus(200)

    const lines = response.body().data as { product_id: number; category: string | null }[]
    assert.equal(lines.find((l) => l.product_id === recipe.id)?.category, 'Plats de vérification')
  })
})

test.group('Catégories de recettes — écriture sur la recette', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('classe une recette à la création', async ({ client, assert }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'Plats de création' })

    const response = await client
      .post('/v1/products')
      .json({ name: 'Burger de vérification', product_category_id: category.id })
      .loginAs(user)

    response.assertStatus(200)
    const created = await Product.findByOrFail('name', 'Burger de vérification')
    assert.equal(created.productCategoryId, category.id)
  })

  test('déclasse une recette avec null', async ({ client, assert }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'Plats à quitter' })
    const recipe = await recipeNamed('Burger à déclasser', category.id)

    const response = await client
      .put(`/v1/products/${recipe.id}`)
      .json({ name: 'Burger à déclasser', product_category_id: null })
      .loginAs(user)

    response.assertStatus(200)
    const reloaded = await Product.findOrFail(recipe.id)
    assert.isNull(reloaded.productCategoryId)
  })

  /**
   * ⚠️ Une écriture qui ne mentionne pas la catégorie ne doit **pas** déclasser
   * la recette : un PUT partiel effacerait sinon un classement que personne n'a
   * demandé de retirer.
   */
  test('une écriture qui tait la catégorie la laisse intacte', async ({ client, assert }) => {
    const user = await cuisinier()
    const category = await ProductCategory.create({ name: 'Plats conservés' })
    const recipe = await recipeNamed('Burger renommé', category.id)

    const response = await client
      .put(`/v1/products/${recipe.id}`)
      .json({ name: 'Burger renommé autrement' })
      .loginAs(user)

    response.assertStatus(200)
    const reloaded = await Product.findOrFail(recipe.id)
    assert.equal(reloaded.productCategoryId, category.id)
  })

  /** Un 404 franc plutôt qu'une violation de clé étrangère en 500. */
  test('répond 404 sur une catégorie inconnue', async ({ client }) => {
    const user = await cuisinier()

    const response = await client
      .post('/v1/products')
      .json({ name: 'Recette orpheline', product_category_id: 999999 })
      .loginAs(user)

    response.assertStatus(404)
  })

  /**
   * ⚠️ `store` / `update` utilisaient `request.all()` — le trou que
   * `CategoriesController` avait. Une clé inconnue ne doit plus atteindre le
   * modèle.
   */
  test('ignore une clé que le validateur ne connaît pas', async ({ client, assert }) => {
    const user = await cuisinier()
    const recipe = await recipeNamed('Recette protégée')

    const response = await client
      .put(`/v1/products/${recipe.id}`)
      .json({ name: 'Recette protégée', id: 999999 })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNotNull(await Product.find(recipe.id))
  })
})

test.group('Seeders — le reclassement de l’existant', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * ⚠️ **Le défaut d'origine, et le test qui l'attrape.** `fetchOrCreateMany`
   * est un *fetch-or-create*, pas un *upsert* : sur une base qui porte déjà les
   * denrées, il les trouve et **ne les met pas à jour**. `category_id` restait
   * donc `NULL` sans un mot — et comme la catégorie des recettes en dérivait,
   * toutes les recettes étaient sans catégorie.
   */
  test('updateOrCreateMany reclasse une denrée déjà en base', async ({ assert }) => {
    const category = await Category.create({ name: 'Frais de vérification' })
    const good = await Good.create({
      name: 'Denrée de vérification',
      unit: 'kg',
      brand: '',
      categoryId: null,
    })

    await Good.updateOrCreateMany('name', [
      { name: good.name, unit: 'kg', brand: '', categoryId: category.id },
    ])

    const reloaded = await Good.findOrFail(good.id)
    assert.equal(reloaded.categoryId, category.id)
  })

  /** La preuve par l'absurde : `fetchOrCreateMany` ne l'aurait pas reclassée. */
  test('fetchOrCreateMany laisse la denrée telle quelle', async ({ assert }) => {
    const category = await Category.create({ name: 'Sec de vérification' })
    const good = await Good.create({
      name: 'Autre denrée de vérification',
      unit: 'kg',
      brand: '',
      categoryId: null,
    })

    await Good.fetchOrCreateMany('name', [
      { name: good.name, unit: 'kg', brand: '', categoryId: category.id },
    ])

    const reloaded = await Good.findOrFail(good.id)
    assert.isNull(reloaded.categoryId)
  })
})
