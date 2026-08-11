import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'

test.group('Job validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  for (const field of ['name', 'description'] as const) {
    test(`a ${field} longer than its column is rejected, not crashed on`, async ({ client }) => {
      const member = await MemberFactory.create()
      const user = await User.findOrFail(member.id)

      const response = await client
        .post('/v1/jobs')
        .loginAs(user)
        .json({ name: 'Barman', [field]: 'a'.repeat(256) })

      response.assertStatus(422)
    })
  }
})
