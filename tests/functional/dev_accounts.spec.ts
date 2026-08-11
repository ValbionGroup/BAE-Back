import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Member from '#models/member'
import User from '#models/user'
import DevAccountSeeder, { DEV_ACCOUNTS, DEV_PASSWORD } from '#database/seeders/dev_account_seeder'
import RoleSeeder from '#database/seeders/role_seeder'

test.group('Dev accounts seeder', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates four accounts that actually authenticate, each with its role', async ({
    assert,
  }) => {
    const client = db.connection()
    await new RoleSeeder(client).run()
    await new DevAccountSeeder(client).run()

    for (const account of DEV_ACCOUNTS) {
      const user = await User.verifyCredentials(account.email, DEV_PASSWORD)
      assert.equal(user.email, account.email)

      const member = await Member.query().where('id', user.id).preload('role').first()
      assert.isNotNull(member, `${account.email} devrait porter une ligne members`)
      assert.equal(member!.role.name, account.role)
    }
  })

  test('is idempotent — a second run creates nothing new', async ({ assert }) => {
    const client = db.connection()
    await new RoleSeeder(client).run()
    await new DevAccountSeeder(client).run()
    const afterFirst = await User.query().count('* as total')

    await new DevAccountSeeder(client).run()
    const afterSecond = await User.query().count('* as total')

    assert.equal(Number(afterSecond[0].$extras.total), Number(afterFirst[0].$extras.total))
  })

  test('never runs outside development and testing', ({ assert }) => {
    assert.deepEqual(DevAccountSeeder.environment, ['development', 'testing'])
  })
})
