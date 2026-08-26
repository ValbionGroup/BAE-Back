import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Supplier from '#models/supplier'
import Job from '#models/job'
import { JobFactory } from '#database/factories/job_factory'
import { EventFactory } from '#database/factories/event_factory'
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

/**
 * Une enseigne portant un bon d'achat. `vouchers.value` et `expires_at` sont
 * `NOT NULL` — il n'y a pas de colonne `code`.
 */
async function supplierWithVoucher(name: string) {
  const supplier = await Supplier.create({ name })
  await db.table('vouchers').insert({
    supplier_id: supplier.id,
    value: 50,
    expires_at: DateTime.now().plus({ months: 6 }).toISODate(),
    created_at: DateTime.now().toSQL(),
    updated_at: DateTime.now().toSQL(),
  })
  return supplier
}

test.group('Référentiels — suppression d’une enseigne', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * ⚠️ L'assertion qui compte n'est pas le 409 : c'est que le bon d'achat
   * **existe encore après**. La FK est en CASCADE, donc sans ce garde-fou la
   * suppression réussissait en détruisant un objet au porteur.
   */
  test('refuse tant qu’un bon d’achat est rattaché, et le bon survit', async ({
    client,
    assert,
  }) => {
    const user = await catalogueur()
    const supplier = await supplierWithVoucher('Carrefour')

    const response = await client.delete(`/v1/suppliers/${supplier.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_SUPPLIER_IN_USE' } })

    const vouchers = await db
      .from('vouchers')
      .where('supplier_id', supplier.id)
      .count('* as total')
      .first()
    assert.equal(Number(vouchers?.total ?? 0), 1)
    assert.isNotNull(await Supplier.find(supplier.id))
  })

  test('refuse tant qu’un prix est rattaché', async ({ client, assert }) => {
    const user = await catalogueur()
    const supplier = await Supplier.create({ name: 'Metro' })
    const [good] = await db
      .table('goods')
      .insert({
        name: `Farine ${supplier.id}`,
        unit: 'kg',
        brand: '',
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })
      .returning('id')
    const goodId = typeof good === 'object' ? Number(good.id) : Number(good)
    await db.table('good_suppliers').insert({
      good_id: goodId,
      supplier_id: supplier.id,
      price: 250,
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })

    const response = await client.delete(`/v1/suppliers/${supplier.id}`).loginAs(user)

    response.assertStatus(409)
    assert.isNotNull(await Supplier.find(supplier.id))
  })

  test('supprime une enseigne que rien n’utilise', async ({ client, assert }) => {
    const user = await catalogueur()
    const supplier = await Supplier.create({ name: 'Enseigne libre' })

    const response = await client.delete(`/v1/suppliers/${supplier.id}`).loginAs(user)

    response.assertStatus(204)
    assert.isNull(await Supplier.find(supplier.id))
  })
})

test.group('Référentiels — suppression d’un poste', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  function coordo() {
    return MemberFactory.create().then((member) =>
      grantPermissions(member, ['job:read', 'job:write', 'job:delete'])
    )
  }

  /**
   * ⚠️ `member_job_preferences` est en CASCADE : sans ce refus, supprimer un
   * poste effaçait les vœux que des membres avaient pris le temps d'exprimer.
   */
  test('refuse tant qu’un membre a exprimé un vœu, et le vœu survit', async ({
    client,
    assert,
  }) => {
    const user = await coordo()
    const job = await JobFactory.create()
    const member = await MemberFactory.create()
    await member.related('preferences').attach({ [job.id]: { rank: 1 } })

    const response = await client.delete(`/v1/jobs/${job.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_JOB_IN_USE' } })

    const rows = await db
      .from('member_job_preferences')
      .where('job_id', job.id)
      .count('* as total')
      .first()
    assert.equal(Number(rows?.total ?? 0), 1)
    assert.isNotNull(await Job.find(job.id))
  })

  test('refuse tant qu’une soirée en a besoin', async ({ client, assert }) => {
    const user = await coordo()
    const job = await JobFactory.create()
    const event = await EventFactory.create()
    await event.related('jobs').attach({ [job.id]: { count: 2 } })

    const response = await client.delete(`/v1/jobs/${job.id}`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_JOB_IN_USE' } })
    assert.isNotNull(await Job.find(job.id))
  })

  test('supprime un poste que rien n’utilise', async ({ client, assert }) => {
    const user = await coordo()
    const job = await JobFactory.create()

    const response = await client.delete(`/v1/jobs/${job.id}`).loginAs(user)

    response.assertStatus(204)
    assert.isNull(await Job.find(job.id))
  })
})

test.group('Référentiels — compteurs d’usage', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * ⚠️ La base de dev est partagée et peuplée : on ne compte que ce que le test
   * a lui-même créé, jamais un total global.
   */
  test('compte les denrées classées dans chaque catégorie', async ({ client, assert }) => {
    const user = await catalogueur()
    const category = await Category.create({ name: 'Surgelés' })
    await db.table('goods').insert({
      name: `Petits pois ${category.id}`,
      unit: 'kg',
      brand: '',
      category_id: category.id,
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })

    const response = await client.get('/v1/categories').loginAs(user)
    response.assertStatus(200)

    const row = (response.body().data as { id: number; goods_count: number }[]).find(
      (entry) => entry.id === category.id
    )
    assert.equal(row?.goods_count, 1)
  })

  test('compte les prix et les bons d’achat de chaque enseigne', async ({ client, assert }) => {
    const user = await catalogueur()
    const supplier = await supplierWithVoucher('Enseigne comptée')

    const response = await client.get('/v1/suppliers').loginAs(user)
    response.assertStatus(200)

    const row = (
      response.body().data as {
        id: number
        voucher_count: number
        priced_goods_count: number
      }[]
    ).find((entry) => entry.id === supplier.id)

    assert.equal(row?.voucher_count, 1)
    assert.equal(row?.priced_goods_count, 0)
  })

  /** Une catégorie que rien ne classe rend `0`, pas `undefined`. */
  test('rend zéro pour une catégorie vide', async ({ client, assert }) => {
    const user = await catalogueur()
    const category = await Category.create({ name: 'Catégorie vide' })

    const response = await client.get('/v1/categories').loginAs(user)

    const row = (response.body().data as { id: number; goods_count: number }[]).find(
      (entry) => entry.id === category.id
    )
    assert.equal(row?.goods_count, 0)
  })
})
