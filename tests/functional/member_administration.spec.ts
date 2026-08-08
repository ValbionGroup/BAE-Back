import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Member administration', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('PATCH on an unknown member answers 404, not 500', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const response = await client.patch('/v1/members/999999').json({ firstName: 'X' }).loginAs(user)

    response.assertStatus(404)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_MEMBER_NOT_FOUND')
    assert.equal(body.error.message, 'Membre introuvable.')
  })

  test('DELETE on an unknown member answers 404, not 500', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const response = await client.delete('/v1/members/999999').loginAs(user)

    response.assertStatus(404)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_MEMBER_NOT_FOUND')
    assert.equal(body.error.message, 'Membre introuvable.')
  })
})
