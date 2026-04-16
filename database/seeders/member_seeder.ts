import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { MembersFactory } from '#database/factories/members_factory'
import Role from '#models/role'

export default class MemberSeeder extends BaseSeeder {
  async run() {
    const roles = await Role.query().select('id')

    if (roles.length === 0) {
      throw new Error('MemberSeeder: no roles found. Run RoleSeeder first.')
    }

    const pickRoleId = () => roles[Math.floor(Math.random() * roles.length)].id

    await MembersFactory
      .with('user')
      .merge(
        Array.from({ length: 10 }, () => ({
          roleId: pickRoleId(),
        }))
      )
      .createMany(10)
  }
}
