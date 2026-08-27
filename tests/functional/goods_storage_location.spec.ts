import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import StorageLocation from '#models/storage_location'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function asGoodsManager() {
  const member = await MemberFactory.create()
  return grantPermissions(member, ['good:read', 'good:write', 'stock:read'])
}

async function makeGood(attributes: Partial<Good> = {}) {
  return Good.create({
    name: 'Crème fraîche',
    unit: 'pcs',
    brand: '',
    categoryId: null,
    ...attributes,
  })
}

test.group('Denrées — emplacement de stockage', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('retient l’emplacement donné à la création', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const freezer = await StorageLocation.create({ name: 'Congélateur de vérification' })

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Steaks hachés', unit: 'pcs', brand: '', storageLocationId: freezer.id })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.storage_location_id, freezer.id)
    const good = await Good.findByOrFail('name', 'Steaks hachés')
    assert.equal(good.storageLocationId, freezer.id)
  })

  // Le champ est facultatif : la colonne est nullable exprès, et l'absence de
  // valeur se lit « pas encore signalé ».
  test('laisse l’emplacement nul quand aucun n’est donné', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sel fin', unit: 'kg', brand: '' })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data.storage_location_id)
  })

  /**
   * ⚠️ Un 404 franc plutôt qu'une violation de clé étrangère en 500 — même règle
   * que `E_PRODUCT_CATEGORY_NOT_FOUND`. C'est ce qui remplace le 422 que rendait
   * l'ancien enum sur une valeur hors liste : il n'y a plus de liste fermée,
   * seulement des lignes qui existent ou non.
   */
  test('refuse un emplacement inconnu par un 404', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Garage', unit: 'pcs', brand: '', storageLocationId: 999999 })
      .loginAs(user)

    response.assertStatus(404)
    assert.isNull(await Good.findBy('name', 'Garage'))
  })

  test('signale l’emplacement d’une denrée déjà au catalogue', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const fridge = await StorageLocation.create({ name: 'Frigo de vérification' })
    const good = await makeGood()

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageLocationId: fridge.id })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.storage_location_id, fridge.id)
    await good.refresh()
    assert.equal(good.storageLocationId, fridge.id)
  })

  test('efface l’emplacement quand null est envoyé', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const cellar = await StorageLocation.create({ name: 'Cave de vérification' })
    const good = await makeGood({ storageLocationId: cellar.id })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageLocationId: null })
      .loginAs(user)

    response.assertStatus(200)
    await good.refresh()
    assert.isNull(good.storageLocationId)
  })

  /**
   * ⚠️ Régression : `update` affectait `name`, `unit` et `categoryId` sans
   * vérifier leur présence, donc un PATCH partiel les écrasait avec `undefined`.
   * Signaler l'emplacement d'une denrée effaçait son nom.
   */
  test('une écriture partielle laisse les autres champs intacts', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const fridge = await StorageLocation.create({ name: 'Frigo partiel' })
    const good = await makeGood({ name: 'Beurre doux', unit: 'kg', brand: 'Elle & Vire' })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageLocationId: fridge.id })
      .loginAs(user)

    response.assertStatus(200)
    await good.refresh()
    assert.equal(good.name, 'Beurre doux')
    assert.equal(good.unit, 'kg')
    assert.equal(good.brand, 'Elle & Vire')
    assert.equal(good.storageLocationId, fridge.id)
  })

  /**
   * ⚠️ L'écart entre « clé absente » et « clé à `null` » : une écriture qui tait
   * l'emplacement ne doit pas l'effacer. Vine omet les clés absentes de sa
   * sortie, et le contrôleur teste la présence par un `in`.
   */
  test('une écriture qui tait l’emplacement le laisse intact', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const dry = await StorageLocation.create({ name: 'Sec conservé' })
    const good = await makeGood({ name: 'Farine T55', storageLocationId: dry.id })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ name: 'Farine T65' })
      .loginAs(user)

    response.assertStatus(200)
    await good.refresh()
    assert.equal(good.storageLocationId, dry.id)
  })

  /**
   * La liste des stocks alimente la colonne « Emplacement » de l'écran. Elle rend
   * **l'id et le nom** : un magasinier sans `storage-location:read` ne peut pas
   * charger le référentiel, donc pas résoudre l'id — sans le nom il perdrait la
   * lecture de l'emplacement en même temps que le droit de le changer.
   */
  test('la liste des stocks rend l’id et le nom de l’emplacement', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const freezer = await StorageLocation.create({ name: 'Congélateur du stock' })
    const good = await makeGood({ name: 'Pâte brisée', storageLocationId: freezer.id })

    const response = await client.get('/v1/stocks').loginAs(user)

    response.assertStatus(200)
    const row = response.body().data.find((r: { id: number }) => r.id === good.id)
    assert.equal(row.storage_location_id, freezer.id)
    assert.equal(row.storage_location, 'Congélateur du stock')
  })

  test('la liste des stocks rend null pour une denrée non rangée', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood({ name: 'Denrée sans emplacement' })

    const response = await client.get('/v1/stocks').loginAs(user)

    const row = response.body().data.find((r: { id: number }) => r.id === good.id)
    assert.isNull(row.storage_location_id)
    assert.isNull(row.storage_location)
  })
})
