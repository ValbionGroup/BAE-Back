import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Furniture from '#models/furniture'
import Good from '#models/good'
import Product from '#models/product'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import Supplier from '#models/supplier'
import { buildShoppingList } from '#services/shopping_list_service'
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

async function makeGood(name: string, unit = 'pcs') {
  return Good.create({ name, unit, brand: 'Marque', categoryId: null })
}

/** Un lot en stock. `label` est `NOT NULL` : toujours le fournir. */
async function stock(good: Good, quantity: number) {
  return StockBatch.create({
    goodId: good.id,
    restockId: null,
    label: `L-${good.id}-${quantity}`,
    quantity: String(quantity),
    expirationDate: DateTime.now().plus({ days: 30 }),
  })
}

async function makeRecipe(name: string, ingredients: [Good, number][]) {
  const product = await Product.create({
    name,
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  let rank = 1
  for (const [good, quantity] of ingredients) {
    await product.related('goods').attach({
      [good.id]: { quantity, rank: rank++, instruction: null },
    })
  }
  return product
}

test.group('Shopping list — arithmétique', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('subtracts the stock on hand from the need', async ({ assert }) => {
    const event = await makeEvent()
    const good = await makeGood('Saucisses')
    await stock(good, 100)
    const recipe = await makeRecipe('Hot-dog', [[good, 2]])
    await event.related('products').attach({ [recipe.id]: { quantity: 80, price: 0 } })

    const list = await buildShoppingList(String(event.id))

    assert.lengthOf(list.lines, 1)
    // 80 hot-dogs × 2 saucisses = 160 ; 100 en stock ; il manque 60.
    assert.strictEqual(list.lines[0].needQty, 160)
    assert.strictEqual(list.lines[0].stockQty, 100)
    assert.strictEqual(list.lines[0].missingQty, 60)
  })

  test('omits a good whose stock already covers the need', async ({ assert }) => {
    const event = await makeEvent()
    const good = await makeGood('Moutarde')
    await stock(good, 500)
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const list = await buildShoppingList(String(event.id))

    // Rien à acheter, donc rien sur la liste : une liste de courses n'énumère
    // pas ce qu'on a déjà.
    assert.lengthOf(list.lines, 0)
    assert.strictEqual(list.lineCount, 0)
  })

  test('counts an ingredient shared by two recipes exactly once', async ({ assert }) => {
    const event = await makeEvent()
    const bun = await makeGood('Pain')
    const sausage = await makeGood('Saucisses')
    // Du stock sur le pain est indispensable ici : à 0, une implémentation qui
    // retrancherait le stock recette par recette (100−0) + (40−0) = 140
    // donnerait le même total que la bonne agrégation, et le test ne
    // prouverait rien. Avec 100 en stock, l'agrégation correcte donne
    // 140 − 100 = 40 de manque, alors qu'une soustraction par recette donnerait
    // max(0,100−100) + max(0,40−100) = 0 et ferait disparaître la ligne : les
    // deux implémentations divergent, donc le test tranche.
    await stock(bun, 100)
    const hotdog = await makeRecipe('Hot-dog', [
      [bun, 1],
      [sausage, 2],
    ])
    const veggie = await makeRecipe('Hot-dog veggie', [[bun, 1]])

    await event.related('products').attach({
      [hotdog.id]: { quantity: 100, price: 0 },
      [veggie.id]: { quantity: 40, price: 0 },
    })

    const list = await buildShoppingList(String(event.id))
    const bunLine = list.lines.find((line) => line.id === bun.id)!

    // 100 + 40 pains, agrégés par denrée AVANT de retrancher le stock. C'est ce
    // qui interdit d'attribuer un manque à une recette : deux recettes se
    // partagent la même denrée, et un chiffre par ligne double-compterait.
    assert.strictEqual(bunLine.needQty, 140)
    assert.strictEqual(bunLine.missingQty, 40)
    // Une ligne par denrée à acheter : le pain (manque 40) et les saucisses
    // (aucun stock, manque 200) — jamais de doublon.
    assert.lengthOf(list.lines, 2)
  })

  test('reads furniture stock from the row, not from batches', async ({ assert }) => {
    const event = await makeEvent()
    // `furnitures` porte son stock et son prix en propre, et n'a aucun
    // fournisseur : le comparatif d'enseignes ne s'y applique pas.
    const tray = await Furniture.create({ name: 'Barquettes', quantity: 30, price: '0.12' })
    const recipe = await Product.create({
      name: 'Frites portion',
      isVegetarian: true,
      description: null,
      recipe: null,
    })
    await recipe.related('furnitures').attach({ [tray.id]: { quantity: 1 } })
    await event.related('products').attach({ [recipe.id]: { quantity: 200, price: 0 } })

    const list = await buildShoppingList(String(event.id))
    const line = list.lines.find((entry) => entry.kind === 'furniture')!

    assert.strictEqual(line.needQty, 200)
    assert.strictEqual(line.stockQty, 30)
    assert.strictEqual(line.missingQty, 170)
    assert.isEmpty(line.suppliers)
    assert.isNull(line.bestSupplier)
    // Son propre prix, converti : la colonne est un `string`.
    assert.strictEqual(line.bestPrice, 0.12)
  })

  test('flags a missing good that no supplier prices', async ({ assert }) => {
    const event = await makeEvent()
    const orphan = await makeGood('Oignons frits')
    const recipe = await makeRecipe('Hot-dog', [[orphan, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 50, price: 0 } })

    const list = await buildShoppingList(String(event.id))

    assert.isNull(list.lines[0].bestPrice)
    assert.strictEqual(list.unpricedCount, 1)
    // Jamais compté comme gratuit : 50 unités inconnues ne valent pas 0 €.
    assert.strictEqual(list.optimumTotal, 0)
  })

  test('computes per-supplier totals and flags incomplete coverage', async ({ assert }) => {
    const event = await makeEvent()
    const bun = await makeGood('Pain')
    const sausage = await makeGood('Saucisses')

    const leclerc = await Supplier.create({ name: 'Leclerc' })
    const auchan = await Supplier.create({ name: 'Auchan' })
    await leclerc.related('goods').attach({ [bun.id]: { price: 2 }, [sausage.id]: { price: 5 } })
    // Auchan ne référence que le pain : couverture incomplète.
    await auchan.related('goods').attach({ [bun.id]: { price: 1 } })

    const recipe = await makeRecipe('Hot-dog', [
      [bun, 1],
      [sausage, 1],
    ])
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const list = await buildShoppingList(String(event.id))
    const byName = (name: string) => list.supplierTotals.find((t) => t.name === name)!

    // Leclerc price tout : 10 × 2 + 10 × 5 = 70.
    assert.strictEqual(byName('Leclerc').total, 70)
    assert.isTrue(byName('Leclerc').fullCoverage)
    // Auchan ne price que le pain : 10 × 1 = 10, mais sur 1 ligne sur 2.
    assert.strictEqual(byName('Auchan').total, 10)
    assert.isFalse(byName('Auchan').fullCoverage)

    // Optimum ligne par ligne : pain chez Auchan (1), saucisses chez Leclerc (5).
    assert.strictEqual(list.optimumTotal, 60)
    // Économie = meilleure enseigne à couverture complète (70) − optimum (60).
    // Une enseigne incomplète est exclue, sinon son total plus bas — parce
    // qu'elle compte moins de lignes — passerait pour le meilleur choix.
    assert.strictEqual(list.savings, 10)
  })

  test('keeps savings goods-only even when a furniture line inflates optimumTotal', async ({
    assert,
  }) => {
    const event = await makeEvent()
    const bun = await makeGood('Pain')
    const sausage = await makeGood('Saucisses')

    const leclerc = await Supplier.create({ name: 'Leclerc' })
    const auchan = await Supplier.create({ name: 'Auchan' })
    await leclerc.related('goods').attach({ [bun.id]: { price: 2 }, [sausage.id]: { price: 5 } })
    await auchan.related('goods').attach({ [bun.id]: { price: 1 } })

    const recipe = await makeRecipe('Hot-dog', [
      [bun, 1],
      [sausage, 1],
    ])

    // Une ligne non alimentaire sans rapport avec les fournisseurs : elle
    // gonfle `optimumTotal` (le coût affiché) mais ne doit pas polluer
    // `savings`, qui ne compare que ce qu'une enseigne peut effectivement
    // vendre.
    const tray = await Furniture.create({ name: 'Barquettes', quantity: 0, price: '0.12' })
    const friesRecipe = await Product.create({
      name: 'Frites portion',
      isVegetarian: true,
      description: null,
      recipe: null,
    })
    await friesRecipe.related('furnitures').attach({ [tray.id]: { quantity: 1 } })

    await event.related('products').attach({
      [recipe.id]: { quantity: 10, price: 0 },
      [friesRecipe.id]: { quantity: 200, price: 0 },
    })

    const list = await buildShoppingList(String(event.id))

    // Panier complet affiché : 60 (denrées, optimum ligne par ligne) + 200 ×
    // 0,12 (barquettes) = 84.
    assert.strictEqual(list.optimumTotal, 84)
    // Économie inchangée : 70 (Leclerc, seule enseigne à couverture complète
    // des DENRÉES) − 60 (optimum denrées) = 10. Le coût des barquettes ne doit
    // pas s'y mêler : aucune enseigne ne les vend.
    assert.strictEqual(list.savings, 10)
  })

  test('reports null savings when no supplier covers everything', async ({ assert }) => {
    const event = await makeEvent()
    const bun = await makeGood('Pain')
    const sausage = await makeGood('Saucisses')
    const leclerc = await Supplier.create({ name: 'Leclerc' })
    await leclerc.related('goods').attach({ [bun.id]: { price: 2 } })

    const recipe = await makeRecipe('Hot-dog', [
      [bun, 1],
      [sausage, 1],
    ])
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const list = await buildShoppingList(String(event.id))

    assert.isNull(list.savings)
    assert.strictEqual(list.unpricedCount, 1)
  })

  test('ignores quantities consumed out of a batch', async ({ assert }) => {
    const event = await makeEvent()
    const good = await makeGood('Frites')
    const batch = await stock(good, 100)
    // `loadBatchesWithRemaining` dérive le restant des mouvements `out`.
    // `good_id` est `NOT NULL` en base (contrairement à ce que suggère le
    // brief) : on le fournit, sans quoi la création échoue en contrainte.
    await StockMovement.create({
      goodId: good.id,
      stockBatchId: batch.id,
      movementType: 'out',
      quantity: '70',
    })

    const recipe = await makeRecipe('Frites portion', [[good, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 100, price: 0 } })

    const list = await buildShoppingList(String(event.id))

    // 100 entrés − 70 sortis = 30 disponibles, pas 100.
    assert.strictEqual(list.lines[0].stockQty, 30)
    assert.strictEqual(list.lines[0].missingQty, 70)
  })
})

test.group('Shopping list — endpoint', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('serves the list to a member holding menu:read and stock:read', async ({
    client,
    assert,
  }) => {
    const event = await makeEvent('Soirée Hivernale')
    const good = await makeGood('Pain')
    const leclerc = await Supplier.create({ name: 'Leclerc' })
    await leclerc.related('goods').attach({ [good.id]: { price: 2 } })
    const recipe = await makeRecipe('Hot-dog', [[good, 1]])
    await event.related('products').attach({ [recipe.id]: { quantity: 10, price: 0 } })

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'stock:read'])

    const response = await client.get(`/v1/events/${event.id}/shopping-list`).loginAs(user)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.event_name, 'Soirée Hivernale')
    assert.strictEqual(body.line_count, 1)
    assert.strictEqual(body.optimum_total, 20)
    assert.strictEqual(body.lines[0].missing_qty, 10)
    assert.strictEqual(body.lines[0].kind, 'good')
  })

  /**
   * Le test qui démontre que la garde à deux permissions est un ET logique.
   * `menu:read` est au socle, donc tout membre l'a ; c'est `stock:read` qui
   * restreint réellement, parce que la liste expose les quantités en stock.
   */
  test('refuses a member holding menu:read but not stock:read', async ({ client, assert }) => {
    const event = await makeEvent()
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read'])

    const response = await client.get(`/v1/events/${event.id}/shopping-list`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
    assert.include(response.body().error.message, 'stock:read')
  })

  test('refuses an unknown evening with an explicit 404', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['menu:read', 'stock:read'])

    const response = await client.get('/v1/events/999999/shopping-list').loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_EVENT_NOT_FOUND')
  })
})
