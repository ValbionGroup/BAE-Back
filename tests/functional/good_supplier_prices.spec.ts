import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Good from '#models/good'
import Supplier from '#models/supplier'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

function acheteur() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['good:read', 'good:write', 'supplier:read'])
  )
}

async function goodNamed(name: string) {
  const [row] = await db
    .table('goods')
    .insert({
      name,
      unit: 'kg',
      brand: '',
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })
    .returning('id')
  const id = typeof row === 'object' ? Number(row.id) : Number(row)
  return await Good.findOrFail(id)
}

async function priceOf(goodId: number, supplierId: number): Promise<number | null> {
  const row = await db
    .from('good_suppliers')
    .where('good_id', goodId)
    .where('supplier_id', supplierId)
    .first()
  return row ? Number(row.price) : null
}

test.group('Prix par enseigne', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('pose un premier tarif', async ({ client, assert }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine T55')
    const supplier = await Supplier.create({ name: 'Metro' })

    const response = await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 250 })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(await priceOf(good.id, supplier.id), 250)
  })

  /** La même route corrige : c'est le même geste pour l'utilisateur. */
  test('corrige un tarif existant sans le dupliquer', async ({ client, assert }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine T65')
    const supplier = await Supplier.create({ name: 'Metro' })

    await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 250 })
      .loginAs(user)
    await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 199 })
      .loginAs(user)

    assert.equal(await priceOf(good.id, supplier.id), 199)
    const rows = await db
      .from('good_suppliers')
      .where('good_id', good.id)
      .count('* as total')
      .first()
    assert.equal(Number(rows?.total ?? 0), 1)
  })

  /**
   * ⚠️ **L'assertion qui compte.** Le prix de référence — celui que
   * `bestSupplierPrice` sert au coût de recette, à la liste de courses et au
   * bilan — est le **moins cher**. Saisir un tarif inférieur doit donc le faire
   * basculer, sinon la saisie n'aurait aucun effet là où elle compte.
   */
  test('le prix de référence bascule sur la nouvelle enseigne la moins chère', async ({
    client,
    assert,
  }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine T80')
    const cher = await Supplier.create({ name: 'Épicerie du coin' })
    const moinsCher = await Supplier.create({ name: 'Metro' })

    await client
      .put(`/v1/goods/${good.id}/suppliers/${cher.id}`)
      .json({ price_cents: 400 })
      .loginAs(user)

    let listed = await client.get('/v1/goods').loginAs(user)
    let row = (listed.body().data as { id: number; best_price: number }[]).find(
      (entry) => entry.id === good.id
    )
    assert.equal(row?.best_price, 400)

    await client
      .put(`/v1/goods/${good.id}/suppliers/${moinsCher.id}`)
      .json({ price_cents: 220 })
      .loginAs(user)

    listed = await client.get('/v1/goods').loginAs(user)
    row = (listed.body().data as { id: number; best_price: number }[]).find(
      (entry) => entry.id === good.id
    )
    assert.equal(row?.best_price, 220)
  })

  test('retire un tarif', async ({ client, assert }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine T110')
    const supplier = await Supplier.create({ name: 'Metro' })
    await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 250 })
      .loginAs(user)

    const response = await client
      .delete(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .loginAs(user)

    response.assertStatus(204)
    assert.isNull(await priceOf(good.id, supplier.id))
  })

  test('refuse un prix négatif ou décimal — ce sont des centimes entiers', async ({ client }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine complète')
    const supplier = await Supplier.create({ name: 'Metro' })

    const negative = await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: -1 })
      .loginAs(user)
    negative.assertStatus(422)

    const decimal = await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 2.5 })
      .loginAs(user)
    decimal.assertStatus(422)
  })

  /** Un 404 franc plutôt qu'une violation de clé étrangère en 500. */
  test('répond 404 sur une enseigne inconnue', async ({ client }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine de seigle')

    const response = await client
      .put(`/v1/goods/${good.id}/suppliers/999999`)
      .json({ price_cents: 250 })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('refuse la saisie à qui n’a pas good:write', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['good:read'])
    const good = await goodNamed('Farine bise')
    const supplier = await Supplier.create({ name: 'Metro' })

    const response = await client
      .put(`/v1/goods/${good.id}/suppliers/${supplier.id}`)
      .json({ price_cents: 250 })
      .loginAs(user)

    response.assertStatus(403)
  })

  /** Le panneau de tarifs lit `GET /goods/:id` : il lui faut les prix, pas
   *  seulement les noms d'enseignes. */
  test('la fiche d’une denrée porte les tarifs et le prix de référence', async ({
    client,
    assert,
  }) => {
    const user = await acheteur()
    const good = await goodNamed('Farine T45')
    const cher = await Supplier.create({ name: 'Épicerie' })
    const moinsCher = await Supplier.create({ name: 'Metro' })
    await client
      .put(`/v1/goods/${good.id}/suppliers/${cher.id}`)
      .json({ price_cents: 400 })
      .loginAs(user)
    await client
      .put(`/v1/goods/${good.id}/suppliers/${moinsCher.id}`)
      .json({ price_cents: 220 })
      .loginAs(user)

    const response = await client.get(`/v1/goods/${good.id}`).loginAs(user)

    response.assertStatus(200)
    const body = response.body().data as {
      suppliers: { id: number; name: string; price: number }[]
      best_price: number
    }
    assert.deepEqual(
      body.suppliers.map((s) => s.price),
      [220, 400],
      'triés du moins cher au plus cher'
    )
    assert.equal(body.best_price, 220)
  })
})
