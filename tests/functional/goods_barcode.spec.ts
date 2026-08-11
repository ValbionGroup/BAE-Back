import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import { UserFactory } from '#database/factories/user_factory'

test.group('Goods barcode', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeGood(name: string, barcode: string | null) {
    return Good.create({ name, unit: 'pcs', brand: '', categoryId: null, barcode })
  }

  test('finds a good by its barcode', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await makeGood('Moutarde', '3268754117904')
    await makeGood('Ketchup', '3168421988011')

    const response = await client.get('/v1/goods?barcode=3268754117904').loginAs(user)

    response.assertStatus(200)
    const body = response.body().data
    assert.lengthOf(body, 1)
    assert.equal(body[0].name, 'Moutarde')
  })

  test('answers with an empty list for an unknown barcode', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await makeGood('Moutarde', '3268754117904')

    const response = await client.get('/v1/goods?barcode=0000000000000').loginAs(user)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 0)
  })

  test('still lists every good when no barcode is given', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await makeGood('Moutarde ZZ', '3268754117904')
    await makeGood('Ketchup ZZ', null)

    const response = await client.get('/v1/goods').loginAs(user)

    response.assertStatus(200)
    const names = response.body().data.map((good: { name: string }) => good.name)
    assert.include(names, 'Moutarde ZZ')
    assert.include(names, 'Ketchup ZZ')
  })

  test('creates a good carrying its barcode', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Cornichons', unit: 'pcs', brand: '', barcode: '4102884002110' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.barcode, '4102884002110')
  })

  test('stores an empty barcode as null', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sans code', unit: 'pcs', brand: '', barcode: '' })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data.barcode)
  })

  test('lets several goods have no barcode at all', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await makeGood('Sans code A', null)

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sans code B', unit: 'pcs', brand: '' })
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data.barcode)
  })

  test('attaches a barcode to an existing good', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const good = await makeGood('Moutarde', null)

    const response = await client
      .patch(`/v1/goods/${good.id}`)
      .json({ name: 'Moutarde', unit: 'pcs', barcode: '3268754117904' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.barcode, '3268754117904')

    await good.refresh()
    assert.equal(good.barcode, '3268754117904')
  })

  test('refuses a barcode already carried by another good', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await makeGood('Moutarde', '3268754117904')
    const other = await makeGood('Ketchup', null)

    const response = await client
      .patch(`/v1/goods/${other.id}`)
      .json({ name: 'Ketchup', unit: 'pcs', barcode: '3268754117904' })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_BARCODE_TAKEN')
  })
})
