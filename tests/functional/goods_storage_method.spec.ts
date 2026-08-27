import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Goods storage method', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

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

  test('stores the storage method given at creation', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Steaks hachés', unit: 'pcs', brand: '', storageMethod: 'freezer' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.storage_method, 'freezer')
    const good = await Good.findByOrFail('name', 'Steaks hachés')
    assert.equal(good.storageMethod, 'freezer')
  })

  // Le champ est facultatif : la colonne est nullable exprès, et l'absence de
  // valeur se lit « pas encore signalé ».
  test('leaves the storage method null when none is given', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sel fin', unit: 'kg', brand: '' })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data.storage_method)
  })

  /**
   * Sans validateur, une valeur hors liste atteint le CHECK de Postgres et part
   * en 500 — le piège que le `<select>` du front évite côté saisie, mais la
   * saisie n'est pas la seule porte d'entrée.
   */
  test('refuses a storage method outside the list', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Garage', unit: 'pcs', brand: '', storageMethod: 'garage' })
      .loginAs(user)

    response.assertStatus(422)
    assert.isNull(await Good.findBy('name', 'Garage'))
  })

  test('sets the storage method on an existing good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood()

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageMethod: 'fridge' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.storage_method, 'fridge')
    await good.refresh()
    assert.equal(good.storageMethod, 'fridge')
  })

  test('clears the storage method when null is sent', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood({ storageMethod: 'cellar' })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageMethod: null })
      .loginAs(user)

    response.assertStatus(200)
    await good.refresh()
    assert.isNull(good.storageMethod)
  })

  /**
   * ⚠️ Régression : `update` affectait `name`, `unit` et `categoryId` sans
   * vérifier leur présence, donc un PATCH partiel les écrasait avec
   * `undefined`. Signaler l'emplacement d'une denrée effaçait son nom.
   */
  test('a partial update leaves the other fields untouched', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood({ name: 'Beurre doux', unit: 'kg', brand: 'Elle & Vire' })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageMethod: 'fridge' })
      .loginAs(user)

    response.assertStatus(200)
    await good.refresh()
    assert.equal(good.name, 'Beurre doux')
    assert.equal(good.unit, 'kg')
    assert.equal(good.brand, 'Elle & Vire')
    assert.equal(good.storageMethod, 'fridge')
  })

  test('refuses an unknown storage method on update', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood({ storageMethod: 'dry' })

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ storageMethod: 'balcon' })
      .loginAs(user)

    response.assertStatus(422)
    await good.refresh()
    assert.equal(good.storageMethod, 'dry')
  })

  // La liste des stocks est ce qui alimente la colonne « Emplacement » de
  // l'écran : sans le champ dans l'agrégat, le tableau ne peut rien afficher.
  test('exposes the storage method in the stocks list', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood({ name: 'Pâte brisée', storageMethod: 'freezer' })

    const response = await client.get('/v1/stocks').loginAs(user)

    response.assertStatus(200)
    const row = response.body().data.find((r: { id: number }) => r.id === good.id)
    assert.equal(row.storage_method, 'freezer')
  })
})
