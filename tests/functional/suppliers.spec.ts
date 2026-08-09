import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'

test.group('Suppliers listing', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * L'endpoint alimente le sélecteur d'enseigne de la modale de création d'un
   * bon d'achat. Il préchargeait `goods` et `restocks` — soit tout le catalogue
   * et tout l'historique de réassort — pour deux colonnes utiles. Ce test
   * empêche qu'un `preload` de confort le regonfle sans qu'on le voie.
   */
  test('lists suppliers by name, without their goods or restocks', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await SupplierFactory.merge({ name: 'Zzz Leclerc' }).create()
    await SupplierFactory.merge({ name: 'Aaa Carrefour' }).create()

    const response = await client.get('/v1/suppliers').loginAs(user)
    response.assertStatus(200)

    const rows: Array<Record<string, unknown>> = response.body().data
    const mine = rows.filter((s) => s.name === 'Zzz Leclerc' || s.name === 'Aaa Carrefour')

    assert.deepEqual(
      mine.map((s) => s.name),
      ['Aaa Carrefour', 'Zzz Leclerc']
    )
    assert.notProperty(mine[0], 'goods')
    assert.notProperty(mine[0], 'restocks')
    assert.property(mine[0], 'id')
  })
})
