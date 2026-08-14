import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Profile permissions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the profile lists the permissions granted by the role', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:read', 'log:read'])

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { permissions: string[] } }
    assert.sameMembers(body.data.permissions, ['role:read', 'log:read'])
  })

  test('a member without a role gets an empty list, not a missing field', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    member.roleId = null
    await member.save()
    const user = await User.findOrFail(member.id)

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { permissions: string[] } }
    assert.deepEqual(body.data.permissions, [])
  })
})
