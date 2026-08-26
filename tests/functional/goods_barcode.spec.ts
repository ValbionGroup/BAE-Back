import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Good from '#models/good'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Goods barcode', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeGood(name: string, ...codes: string[]) {
    const good = await Good.create({ name, unit: 'pcs', brand: '', categoryId: null })
    if (codes.length > 0) {
      await good.related('barcodes').createMany(codes.map((code) => ({ code })))
    }
    return good
  }

  async function asGoodsManager() {
    const member = await MemberFactory.create()
    return grantPermissions(member, ['good:read', 'good:write'])
  }

  test('finds a good by its barcode', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde', '3268754117904')
    await makeGood('Ketchup', '3168421988011')

    const response = await client.get('/v1/goods?barcode=3268754117904').loginAs(user)

    response.assertStatus(200)
    const body = response.body().data
    assert.lengthOf(body, 1)
    assert.equal(body[0].name, 'Moutarde')
  })

  // Le cœur de la fonctionnalité : un aliment se vend sous plusieurs
  // conditionnements, et n'importe lequel doit ramener la même fiche.
  test('finds the same good by any of its barcodes', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Nutella', '3017620422003', '3017620425004')

    for (const code of ['3017620422003', '3017620425004']) {
      const response = await client.get(`/v1/goods?barcode=${code}`).loginAs(user)

      response.assertStatus(200)
      const body = response.body().data
      assert.lengthOf(body, 1)
      assert.equal(body[0].name, 'Nutella')
    }
  })

  test('exposes every barcode of a good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood('Nutella', '3017620422003', '3017620425004')

    const response = await client.get(`/v1/goods/${good.id}`).loginAs(user)

    response.assertStatus(200)
    assert.sameMembers(response.body().data.barcodes, ['3017620422003', '3017620425004'])
  })

  test('answers with an empty list for an unknown barcode', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde', '3268754117904')

    const response = await client.get('/v1/goods?barcode=0000000000000').loginAs(user)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 0)
  })

  test('still lists every good when no barcode is given', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde ZZ', '3268754117904')
    await makeGood('Ketchup ZZ')

    const response = await client.get('/v1/goods').loginAs(user)

    response.assertStatus(200)
    const names = response.body().data.map((good: { name: string }) => good.name)
    assert.include(names, 'Moutarde ZZ')
    assert.include(names, 'Ketchup ZZ')
  })

  test('creates a good carrying its barcode', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Cornichons', unit: 'pcs', brand: '', barcodes: ['4102884002110'] })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data.barcodes, ['4102884002110'])
  })

  test('creates a good with no barcode at all', async ({ client, assert }) => {
    const user = await asGoodsManager()

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sans code', unit: 'pcs', brand: '', barcodes: [] })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data.barcodes, [])
  })

  test('lets several goods have no barcode at all', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Sans code A')

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Sans code B', unit: 'pcs', brand: '' })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data.barcodes, [])
  })

  test('attaches a barcode to an existing good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood('Moutarde')

    const response = await client
      .post(`/v1/goods/${good.id}/barcodes`)
      .json({ code: '3268754117904' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.code, '3268754117904')

    await good.load('barcodes')
    assert.deepEqual(
      good.barcodes.map((barcode) => barcode.code),
      ['3268754117904']
    )
  })

  test('adds a second barcode without dropping the first', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood('Nutella', '3017620422003')

    const response = await client
      .post(`/v1/goods/${good.id}/barcodes`)
      .json({ code: '3017620425004' })
      .loginAs(user)

    response.assertStatus(200)

    await good.load('barcodes')
    assert.sameMembers(
      good.barcodes.map((barcode) => barcode.code),
      ['3017620422003', '3017620425004']
    )
  })

  test('refuses a barcode already carried by another good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde', '3268754117904')
    const other = await makeGood('Ketchup')

    const response = await client
      .post(`/v1/goods/${other.id}/barcodes`)
      .json({ code: '3268754117904' })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_BARCODE_TAKEN')
  })

  // La denrée ne doit pas rester derrière sans son code : le doublon qu'elle
  // provoquerait est exactement ce que les codes multiples suppriment.
  test('creates no good at all when one of its barcodes is taken', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde', '3268754117904')

    const response = await client
      .post('/v1/goods')
      .json({ name: 'Doublon', unit: 'pcs', brand: '', barcodes: ['3268754117904'] })
      .loginAs(user)

    response.assertStatus(409)
    assert.isNull(await Good.findBy('name', 'Doublon'))
  })

  test('detaches a barcode from its good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    const good = await makeGood('Nutella', '3017620422003', '3017620425004')

    const response = await client
      .delete(`/v1/goods/${good.id}/barcodes/3017620425004`)
      .loginAs(user)

    response.assertStatus(204)

    await good.load('barcodes')
    assert.deepEqual(
      good.barcodes.map((barcode) => barcode.code),
      ['3017620422003']
    )
  })

  test('refuses to detach a barcode carried by another good', async ({ client, assert }) => {
    const user = await asGoodsManager()
    await makeGood('Moutarde', '3268754117904')
    const other = await makeGood('Ketchup', '3168421988011')

    const response = await client
      .delete(`/v1/goods/${other.id}/barcodes/3268754117904`)
      .loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_BARCODE_NOT_FOUND')
  })

  test('refuses a barcode that is not made of digits', async ({ client }) => {
    const user = await asGoodsManager()
    const good = await makeGood('Moutarde')

    const response = await client
      .post(`/v1/goods/${good.id}/barcodes`)
      .json({ code: '3268-754 117904' })
      .loginAs(user)

    response.assertStatus(422)
  })
})
