import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import type Event from '#models/event'

function manager() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['menu:read', 'menu:write', 'menu:delete'])
  )
}

function reader() {
  return MemberFactory.create().then((member) => grantPermissions(member, ['menu:read']))
}

async function sponsoredEvent(payerName: string | null = 'BDE'): Promise<Event> {
  return EventFactory.merge({ payerName }).create()
}

function burger() {
  return Product.create({
    name: 'Burger maison',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
}

test.group('Sponsorship categories', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuse une catégorie externe tant que le payeur n’est pas renseigné', async ({
    client,
  }) => {
    const user = await manager()
    const event = await sponsoredEvent(null)

    const response = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_SPONSORSHIP_NO_PAYER' } })
  })

  test('refuse deux homonymes sur la même soirée, les accepte sur deux soirées', async ({
    client,
  }) => {
    const user = await manager()
    const first = await sponsoredEvent()
    const second = await sponsoredEvent()

    const created = await client
      .post(`/v1/events/${first.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    created.assertStatus(200)

    const duplicate = await client
      .post(`/v1/events/${first.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    duplicate.assertStatus(422)

    const elsewhere = await client
      .post(`/v1/events/${second.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    elsewhere.assertStatus(200)
  })

  test('un prix nul retire la ligne, zéro la garde', async ({ client, assert }) => {
    const user = await manager()
    const event = await sponsoredEvent()
    const product = await burger()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    const categoryId = category.body().data.id

    const zeroed = await client
      .put(`/v1/events/${event.id}/sponsorship-categories/${categoryId}/prices`)
      .json({ prices: [{ product_id: product.id, price_cents: 0 }] })
      .loginAs(user)
    zeroed.assertStatus(200)
    assert.deepEqual(zeroed.body().data.prices, [{ product_id: product.id, price_cents: 0 }])

    const cleared = await client
      .put(`/v1/events/${event.id}/sponsorship-categories/${categoryId}/prices`)
      .json({ prices: [{ product_id: product.id, price_cents: null }] })
      .loginAs(user)
    cleared.assertStatus(200)
    assert.deepEqual(cleared.body().data.prices, [])
  })

  test('refuse un prix négatif', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent()
    const product = await burger()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)

    const response = await client
      .put(`/v1/events/${event.id}/sponsorship-categories/${category.body().data.id}/prices`)
      .json({ prices: [{ product_id: product.id, price_cents: -100 }] })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('refuse la suppression d’une catégorie déjà vendue', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    const categoryId = category.body().data.id

    await db.table('orders').insert({
      event_id: event.id,
      status: 'pending',
      sponsorship_category_id: categoryId,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const refused = await client
      .delete(`/v1/events/${event.id}/sponsorship-categories/${categoryId}`)
      .loginAs(user)

    refused.assertStatus(409)
    refused.assertBodyContains({ error: { code: 'E_CATEGORY_IN_USE' } })
  })

  test('refuse une catégorie d’une autre soirée', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent()
    const other = await sponsoredEvent()

    const category = await client
      .post(`/v1/events/${other.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)

    const response = await client
      .patch(`/v1/events/${event.id}/sponsorship-categories/${category.body().data.id}`)
      .json({ label: 'Volé' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('menu:read ne suffit pas pour écrire', async ({ client }) => {
    const user = await reader()
    const event = await sponsoredEvent()

    const response = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)

    response.assertStatus(403)
  })

  // Le pendant du test précédent, et la raison d'être du mode interne : sans
  // payeur il n'y a personne à réclamer, mais le BAE peut décider d'offrir.
  test('accepte une catégorie interne sans aucun payeur', async ({ client, assert }) => {
    const user = await manager()
    const event = await sponsoredEvent(null)

    const response = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Invités du BAE', mode: 'internal' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.mode, 'internal')
  })

  test('refuse un mode inconnu', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent()

    const response = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'gratuit' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('bascule le mode tant qu’aucune commande n’existe', async ({ client, assert }) => {
    const user = await manager()
    const event = await sponsoredEvent()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)

    const response = await client
      .patch(`/v1/events/${event.id}/sponsorship-categories/${category.body().data.id}`)
      .json({ mode: 'internal' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.mode, 'internal')
  })

  // Le verrou : le bilan et le justificatif se lisent en joignant cette colonne,
  // donc la changer après une vente réécrirait des documents déjà rendus.
  test('refuse la bascule du mode d’une catégorie déjà vendue', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    const categoryId = category.body().data.id

    await db.table('orders').insert({
      event_id: event.id,
      status: 'pending',
      sponsorship_category_id: categoryId,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const refused = await client
      .patch(`/v1/events/${event.id}/sponsorship-categories/${categoryId}`)
      .json({ mode: 'internal' })
      .loginAs(user)

    refused.assertStatus(409)
    refused.assertBodyContains({ error: { code: 'E_CATEGORY_IN_USE' } })
  })

  // Le libellé est recopié sur la commande : le renommer ne réécrit aucun
  // historique, il n'a donc pas à être verrouillé comme le mode.
  test('laisse renommer une catégorie déjà vendue', async ({ client, assert }) => {
    const user = await manager()
    const event = await sponsoredEvent()

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Staff BDE', mode: 'external' })
      .loginAs(user)
    const categoryId = category.body().data.id

    await db.table('orders').insert({
      event_id: event.id,
      status: 'pending',
      sponsorship_category_id: categoryId,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const renamed = await client
      .patch(`/v1/events/${event.id}/sponsorship-categories/${categoryId}`)
      .json({ label: 'Staff BDE 2026' })
      .loginAs(user)

    renamed.assertStatus(200)
    assert.equal(renamed.body().data.label, 'Staff BDE 2026')
    assert.equal(renamed.body().data.mode, 'external')
  })

  test('refuse le passage en externe sans payeur', async ({ client }) => {
    const user = await manager()
    const event = await sponsoredEvent(null)

    const category = await client
      .post(`/v1/events/${event.id}/sponsorship-categories`)
      .json({ label: 'Invités du BAE', mode: 'internal' })
      .loginAs(user)

    const response = await client
      .patch(`/v1/events/${event.id}/sponsorship-categories/${category.body().data.id}`)
      .json({ mode: 'external' })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_SPONSORSHIP_NO_PAYER' } })
  })
})
