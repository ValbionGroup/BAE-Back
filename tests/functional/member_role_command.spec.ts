import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import Role from '#models/role'
import { MemberFactory } from '#database/factories/members_factory'
import MemberRole from '../../commands/member_role.js'

/**
 * The console-only escape hatch for the two RBAC guards added in tasks 3 and
 * 4: a lone holder of a permission set who leaves without handing over would
 * otherwise be unreachable from the HTTP admin screens. This command writes
 * `member.role_id` directly and never calls the guards it exists to bypass.
 */
test.group('member:role command', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('assigns a role regardless of the RBAC guards', async ({ assert }) => {
    const member = await MemberFactory.create()
    const role = await Role.create({ name: 'Pole Console' })

    const command = await ace.create(MemberRole, [String(member.id), 'Pole Console'])
    await command.exec()

    command.assertSucceeded()
    await member.refresh()
    assert.equal(member.roleId, role.id)
  })

  test('none clears the role', async ({ assert }) => {
    const role = await Role.create({ name: 'Pole Depart' })
    const member = await MemberFactory.merge({ roleId: role.id }).create()

    const command = await ace.create(MemberRole, [String(member.id), 'none'])
    await command.exec()

    command.assertSucceeded()
    await member.refresh()
    assert.isNull(member.roleId)
  })

  test('--dry-run writes nothing', async ({ assert }) => {
    const member = await MemberFactory.create()
    await Role.create({ name: 'Pole Sec' })

    const command = await ace.create(MemberRole, [String(member.id), 'Pole Sec', '--dry-run'])
    await command.exec()

    command.assertSucceeded()
    await member.refresh()
    assert.isNull(member.roleId, 'un dry-run ne doit rien écrire')
  })

  test('fails on an unknown member', async ({ }) => {
    const command = await ace.create(MemberRole, ['999999', 'Administrateur'])
    await command.exec()

    command.assertFailed()
  })

  test('fails on an unknown role and writes nothing', async ({ assert }) => {
    const member = await MemberFactory.create()

    const command = await ace.create(MemberRole, [String(member.id), 'Inexistant'])
    await command.exec()

    command.assertFailed()
    await member.refresh()
    assert.isNull(member.roleId)
  })
})
