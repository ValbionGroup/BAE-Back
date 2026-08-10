import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'

/**
 * `jobs.name` and `jobs.description` are both `varchar(255)`. Without a
 * matching cap in the validator, an over-long value reaches Postgres and raises
 * a `DatabaseError`, which surfaces as a 500 rather than a validation failure.
 */
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
