import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Voucher from '#models/voucher'
import { MemberFactory } from '#database/factories/members_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeVoucher(supplierId: number, usedAt: DateTime | null = null) {
  return Voucher.create({
    supplierId,
    value: 2000,
    expiresAt: DateTime.now().plus({ days: 30 }),
    condition: null,
    usedAt,
  })
}

test.group('Vouchers', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a voucher and returns it with its supplier', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['voucher:read', 'voucher:write'])
    const supplier = await SupplierFactory.merge({ name: 'Leclerc' }).create()

    const response = await client
      .post('/v1/vouchers')
      .json({
        supplier_id: supplier.id,
        value: 2550,
        expires_at: '2026-12-31',
        condition: 'à partir de 80 €',
      })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body().data
    assert.strictEqual(body.value, 2550)
    assert.strictEqual(body.expires_at, '2026-12-31')
    assert.isFalse(body.used)
    assert.isNull(body.used_at)
    assert.equal(body.supplier.name, 'Leclerc')

    // ⚠️ La réponse d'un POST ne prouve rien sur la colonne : Lucid rend la
    // valeur qu'on vient de lui affecter, sans la relire. Seule une relecture
    // montre ce que Postgres a réellement stocké — et c'est la seule assertion
    // de ce fichier qui verrouille l'unité.
    const reread = await client.get('/v1/vouchers').loginAs(user)
    const stored = reread.body().data.find((row: { id: number }) => row.id === body.id)
    assert.strictEqual(stored.value, 2550)
    assert.isTrue(Number.isInteger(stored.value))
  })

  test('marks a voucher as consumed', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['voucher:read', 'voucher:write'])
    const supplier = await SupplierFactory.create()
    const voucher = await makeVoucher(supplier.id)

    const response = await client
      .patch(`/v1/vouchers/${voucher.id}`)
      .json({ used_at: DateTime.now().toISO() })
      .loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.body().data.used)
    assert.isNotNull(response.body().data.used_at)

    await voucher.refresh()
    assert.isNotNull(voucher.usedAt)
  })

  test('clears the consumption date when used_at is explicitly null', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['voucher:read', 'voucher:write'])
    const supplier = await SupplierFactory.create()
    const voucher = await makeVoucher(supplier.id, DateTime.now())

    const response = await client
      .patch(`/v1/vouchers/${voucher.id}`)
      .json({ used_at: null })
      .loginAs(user)

    response.assertStatus(200)
    assert.isFalse(response.body().data.used)
    assert.isNull(response.body().data.used_at)

    await voucher.refresh()
    assert.isNull(voucher.usedAt)
  })

  test('refuses a voucher value carrying decimals', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['voucher:write'])
    const supplier = await SupplierFactory.create()

    // Une valeur en euros envoyee telle quelle serait tronquee en base sans
    // que rien ne proteste : le validator la refuse a la frontiere.
    const response = await client
      .post('/v1/vouchers')
      .json({ supplier_id: supplier.id, value: 12.5, expires_at: '2027-01-01' })
      .loginAs(user)

    response.assertStatus(422)
  })
})
