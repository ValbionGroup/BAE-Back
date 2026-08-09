import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Voucher from '#models/voucher'
import { UserFactory } from '#database/factories/user_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'

/**
 * Crée un bon directement plutôt que par une factory : c'est le seul fichier
 * qui en a besoin, et une factory de plus pour trois tests coûterait plus à
 * lire qu'elle ne fait gagner.
 */
async function makeVoucher(supplierId: number, usedAt: DateTime | null = null) {
  return Voucher.create({
    supplierId,
    value: '20.00',
    expiresAt: DateTime.now().plus({ days: 30 }),
    condition: null,
    usedAt,
  })
}

test.group('Vouchers', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a voucher and returns it with its supplier', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const supplier = await SupplierFactory.merge({ name: 'Leclerc' }).create()

    const response = await client
      .post('/v1/vouchers')
      .json({
        supplier_id: supplier.id,
        value: 25.5,
        expires_at: '2026-12-31',
        condition: 'à partir de 80 €',
      })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body().data
    // `value` est une colonne decimal : le driver la rend en string, le
    // contrôleur la renumérote. Le front somme les bons sans parser.
    assert.strictEqual(body.value, 25.5)
    assert.strictEqual(body.expires_at, '2026-12-31')
    assert.isFalse(body.used)
    assert.isNull(body.used_at)
    assert.equal(body.supplier.name, 'Leclerc')
  })

  test('marks a voucher as consumed', async ({ client, assert }) => {
    const user = await UserFactory.create()
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

  /**
   * Le test qui compte. `used_at: null` doit *effacer* la date, pas être traité
   * comme une clé absente — le contrôleur teste `'usedAt' in payload`, donc
   * tout repose sur ce que Vine fait d'un `null` explicite sur un champ
   * `.nullable().optional()`.
   *
   * La relecture en base est indispensable : la réponse pourrait refléter un
   * modèle en mémoire que la colonne n'a jamais reçu.
   */
  test('clears the consumption date when used_at is explicitly null', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
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
})
