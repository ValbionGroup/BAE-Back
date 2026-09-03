import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import hash from '@adonisjs/core/services/hash'
import Member from '#models/member'
import Role from '#models/role'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { UserFactory } from '#database/factories/user_factory'
import MemberCreate from '../../commands/member_create.js'

test.group('member:create command', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('creates a credential-less account and its membership under the same id', async ({
    assert,
  }) => {
    const role = await Role.create({ name: 'Pole Console' })

    const command = await ace.create(MemberCreate, [
      'nouveau@bae.test',
      '--role=Pole Console',
      '--first-name=Nour',
      '--last-name=Membre',
    ])
    await command.exec()

    command.assertSucceeded()
    const user = await User.findByOrFail('email', 'nouveau@bae.test')
    assert.equal(user.firstName, 'Nour')
    assert.equal(user.lastName, 'Membre')
    assert.isNull(user.password, 'sans --password le compte reste sans identifiant')

    const member = await Member.find(user.id)
    assert.isNotNull(member)
    assert.equal(member!.roleId, role.id)
  })

  test('promotes an existing account without creating a second one', async ({ assert }) => {
    const existing = await UserFactory.merge({ email: 'sso@bae.test' }).create()

    const command = await ace.create(MemberCreate, ['sso@bae.test'])
    await command.exec()

    command.assertSucceeded()
    const accounts = await User.query().where('email', 'sso@bae.test')
    assert.lengthOf(accounts, 1, 'la promotion doit réutiliser le compte existant')
    assert.isNotNull(await Member.find(existing.id))
  })

  test('sets the password of an account that has none', async ({ assert }) => {
    const existing = await UserFactory.merge({ email: 'sso@bae.test', password: null }).create()

    const command = await ace.create(MemberCreate, ['sso@bae.test', '--password=Motdepasse123'])
    await command.exec()

    command.assertSucceeded()
    await existing.refresh()
    assert.isNotNull(existing.password)
    assert.isTrue(await hash.verify(existing.password!, 'Motdepasse123'))
  })

  test('refuses to overwrite a password that is already set', async ({ assert }) => {
    const existing = await UserFactory.merge({ email: 'compte@bae.test' }).create()
    const before = existing.password

    const command = await ace.create(MemberCreate, ['compte@bae.test', '--password=Motdepasse123'])
    await command.exec()

    command.assertFailed()
    await existing.refresh()
    assert.equal(existing.password, before)
    assert.isNull(await Member.find(existing.id), 'un échec ne doit pas créer la ligne membre')
  })

  test('refuses an account that is already a member', async ({ assert }) => {
    const member = await MemberFactory.with('user').create()

    const command = await ace.create(MemberCreate, [member.user.email])
    await command.exec()

    command.assertFailed()
    assert.lengthOf(await User.query().where('email', member.user.email), 1)
  })

  test('refuses an unknown role and writes nothing', async ({ assert }) => {
    const command = await ace.create(MemberCreate, ['nouveau@bae.test', '--role=Inexistant'])
    await command.exec()

    command.assertFailed()
    assert.isNull(await User.findBy('email', 'nouveau@bae.test'))
  })

  test('refuses a malformed email', async ({ assert }) => {
    const command = await ace.create(MemberCreate, ['pas-une-adresse'])
    await command.exec()

    command.assertFailed()
    assert.lengthOf(await User.query().where('email', 'pas-une-adresse'), 0)
  })

  test('--dry-run writes nothing', async ({ assert }) => {
    await Role.create({ name: 'Pole Sec' })

    const command = await ace.create(MemberCreate, [
      'nouveau@bae.test',
      '--role=Pole Sec',
      '--dry-run',
    ])
    await command.exec()

    command.assertSucceeded()
    assert.isNull(await User.findBy('email', 'nouveau@bae.test'))
  })
})
