import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import StorageLocation from '#models/storage_location'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

function magasinier() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, [
      'storage-location:read',
      'storage-location:write',
      'storage-location:delete',
    ])
  )
}

async function goodAt(name: string, storageLocationId: number | null = null) {
  return Good.create({ name, unit: 'pcs', brand: '', categoryId: null, storageLocationId })
}

test.group('Lieux de stockage — CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuse un lieu sans nom', async ({ client }) => {
    const user = await magasinier()
    const response = await client.post('/v1/storage-locations').json({ name: ' ' }).loginAs(user)
    response.assertStatus(422)
  })

  test('crée un lieu en rognant les espaces', async ({ client, assert }) => {
    const user = await magasinier()

    const response = await client
      .post('/v1/storage-locations')
      .json({ name: '  Réserve  ' })
      .loginAs(user)

    response.assertStatus(200)
    const created = await StorageLocation.findByOrFail('name', 'Réserve')
    assert.equal(created.name, 'Réserve')
  })

  test('renomme un lieu', async ({ client, assert }) => {
    const user = await magasinier()
    const location = await StorageLocation.create({ name: 'Cave à renommer' })

    const response = await client
      .patch(`/v1/storage-locations/${location.id}`)
      .json({ name: 'Cellier' })
      .loginAs(user)

    response.assertStatus(200)
    await location.refresh()
    assert.equal(location.name, 'Cellier')
  })

  test('compte les denrées rangées dans chaque lieu', async ({ client, assert }) => {
    const user = await magasinier()
    const location = await StorageLocation.create({ name: 'Frigo de vérification' })
    await goodAt('Crème de vérification', location.id)

    const response = await client.get('/v1/storage-locations').loginAs(user)
    response.assertStatus(200)

    const row = (response.body().data as { id: number; goods_count: number }[]).find(
      (entry) => entry.id === location.id
    )
    assert.equal(row?.goods_count, 1)
  })

  test('compte zéro pour un lieu que rien n’occupe', async ({ client, assert }) => {
    const user = await magasinier()
    const location = await StorageLocation.create({ name: 'Lieu vide de vérification' })

    const response = await client.get('/v1/storage-locations').loginAs(user)

    const row = (response.body().data as { id: number; goods_count: number }[]).find(
      (entry) => entry.id === location.id
    )
    assert.equal(row?.goods_count, 0)
  })

  /**
   * ⚠️ **L'assertion qui compte, et la différence assumée avec les enseignes.**
   * `goods.storage_location_id` est en `SET NULL` : supprimer un lieu
   * **déclasse** les denrées, il n'en perd aucune. Refuser en 409 serait une
   * rigidité sans contrepartie — une denrée sans emplacement se lit « pas encore
   * signalé », l'état normal de départ.
   */
  test('supprimer un lieu déclasse ses denrées sans les détruire', async ({ client, assert }) => {
    const user = await magasinier()
    const location = await StorageLocation.create({ name: 'À supprimer' })
    const good = await goodAt('Denrée de vérification', location.id)

    const response = await client.delete(`/v1/storage-locations/${location.id}`).loginAs(user)

    response.assertStatus(204)
    const reloaded = await Good.findOrFail(good.id)
    assert.isNull(reloaded.storageLocationId)
    assert.equal(reloaded.name, 'Denrée de vérification')
  })

  test('refuse l’écriture à qui n’a pas storage-location:write', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['storage-location:read'])

    const response = await client
      .post('/v1/storage-locations')
      .json({ name: 'Interdit' })
      .loginAs(user)
    response.assertStatus(403)
  })

  test('refuse la lecture à qui ne porte aucun droit sur le référentiel', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['good:read'])

    const response = await client.get('/v1/storage-locations').loginAs(user)
    response.assertStatus(403)
  })

  /**
   * ⚠️ Le trou que `CategoriesController` avait avant sa correction : `merge()`
   * sur `request.all()` laissait passer n'importe quelle colonne, `id` compris.
   * Le validateur ne connaît que `name`.
   */
  test('ignore une clé que le validateur ne connaît pas', async ({ client, assert }) => {
    const user = await magasinier()
    const location = await StorageLocation.create({ name: 'Lieu protégé' })

    const response = await client
      .patch(`/v1/storage-locations/${location.id}`)
      .json({ name: 'Lieu protégé', id: 999999 })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNotNull(await StorageLocation.find(location.id))
  })
})
