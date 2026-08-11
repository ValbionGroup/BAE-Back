import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { grantPermissions } from '#tests/helpers/permissions'

type ErrorBody = { error: { code: string; message: string } }

test.group('Vouchers authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function userWith(permissions: string[]) {
    // `MemberFactory` and not `UserFactory`: the guard resolves
    // `user → member → role`, so a user with no `members` row is refused whatever
    // they hold — the "no permission" case would then prove nothing.
    const member = await MemberFactory.create()
    return grantPermissions(member, permissions)
  }

  test('refuses to list vouchers without voucher:read', async ({ client, assert }) => {
    const user = await userWith([])

    const response = await client.get('/v1/vouchers').loginAs(user)

    response.assertStatus(403)
    const body = response.body() as unknown as ErrorBody
    assert.equal(body.error.code, 'E_FORBIDDEN')
    assert.include(body.error.message, 'voucher:read')
  })

  test('lists vouchers with voucher:read', async ({ client }) => {
    const user = await userWith(['voucher:read'])

    const response = await client.get('/v1/vouchers').loginAs(user)

    response.assertStatus(200)
  })

  test('refuses to create a voucher with voucher:read alone', async ({ client, assert }) => {
    const user = await userWith(['voucher:read'])
    const supplier = await SupplierFactory.create()

    const response = await client
      .post('/v1/vouchers')
      .json({ supplier_id: supplier.id, value: 10, expires_at: '2026-12-31', condition: null })
      .loginAs(user)

    response.assertStatus(403)
    assert.include((response.body() as unknown as ErrorBody).error.message, 'voucher:write')
  })

  test('creates a voucher with voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:write'])
    const supplier = await SupplierFactory.create()

    const response = await client
      .post('/v1/vouchers')
      .json({ supplier_id: supplier.id, value: 10, expires_at: '2026-12-31', condition: null })
      .loginAs(user)

    response.assertStatus(200)
  })

  test('refuses to consume a voucher without voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:read'])
    const response = await client
      .patch('/v1/vouchers/1')
      .json({ used_at: DateTime.now().toISO() })
      .loginAs(user)

    response.assertStatus(403)
  })

  test('refuses to delete a voucher without voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:read'])
    const response = await client.delete('/v1/vouchers/1').loginAs(user)

    response.assertStatus(403)
  })
})
