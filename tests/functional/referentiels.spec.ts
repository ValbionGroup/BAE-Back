import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

function catalogueur() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, [
      'category:read',
      'category:write',
      'category:delete',
      'supplier:read',
      'supplier:write',
      'supplier:delete',
    ])
  )
}

test.group('Référentiels — validation des écritures', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuse une catégorie sans nom', async ({ client }) => {
    const user = await catalogueur()
    const response = await client.post('/v1/categories').json({ name: '  ' }).loginAs(user)
    response.assertStatus(422)
  })

  test('refuse une enseigne sans nom', async ({ client }) => {
    const user = await catalogueur()
    const response = await client.post('/v1/suppliers').json({ name: '' }).loginAs(user)
    response.assertStatus(422)
  })

  /**
   * `request.all()` fusionnait toute la charge utile dans le modèle : un client
   * pouvait réassigner la clé primaire d'une catégorie.
   */
  test('ignore une clé que le validateur ne connaît pas', async ({ client, assert }) => {
    const user = await catalogueur()
    const category = await Category.create({ name: 'Boissons' })

    const response = await client
      .patch(`/v1/categories/${category.id}`)
      .json({ name: 'Boissons fraîches', id: 999_999 })
      .loginAs(user)

    response.assertStatus(200)

    const reloaded = await Category.findOrFail(category.id)
    assert.equal(reloaded.name, 'Boissons fraîches')
    assert.equal(reloaded.id, category.id)
  })

  test('crée une catégorie en rognant les espaces', async ({ client, assert }) => {
    const user = await catalogueur()
    const response = await client
      .post('/v1/categories')
      .json({ name: '  Épicerie  ' })
      .loginAs(user)

    response.assertStatus(200)
    const created = await Category.findByOrFail('name', 'Épicerie')
    assert.equal(created.name, 'Épicerie')
  })
})
