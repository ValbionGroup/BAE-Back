import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import Member from '#models/member'
import Role from '#models/role'
import User from '#models/user'
import type { RoleName } from '#database/rbac_catalog'

export const DEV_PASSWORD = 'bae-dev-password'

export const DEV_ACCOUNTS: readonly {
  email: string
  firstName: string
  lastName: string
  role: RoleName
}[] = [
  { email: 'admin@bae.test', firstName: 'Alex', lastName: 'Admin', role: 'Administrateur' },
  { email: 'log@bae.test', firstName: 'Léa', lastName: 'Logistique', role: 'Pole Log' },
  { email: 'coordo@bae.test', firstName: 'Camille', lastName: 'Coordo', role: 'Coordinateur' },
  { email: 'membre@bae.test', firstName: 'Manon', lastName: 'Membre', role: 'Membre' },
]

export default class extends BaseSeeder {
  // The guard that counts: deployment runs `db:seed` to install the RBAC
  // permissions. Without this list, four accounts with known credentials — one of
  // them an `Administrateur` — would be created IN PRODUCTION. It is Adonis' own
  // runner that must refuse; a comment would protect nothing.
  static environment = ['development', 'testing']

  async run() {
    if (app.inProduction) {
      return
    }

    const roles = await Role.query()
    const roleIdByName = new Map(roles.map((role) => [role.name, role.id]))

    if (roles.length === 0) {
      throw new Error('DevAccountSeeder: no roles found. Run RoleSeeder first.')
    }

    for (const account of DEV_ACCOUNTS) {
      const roleId = roleIdByName.get(account.role)
      if (roleId === undefined) {
        throw new Error(
          `DevAccountSeeder: role "${account.role}" not found. Is the RBAC catalogue seeded?`
        )
      }

      const user = await User.firstOrCreate(
        { email: account.email },
        { email: account.email, password: DEV_PASSWORD }
      )

      await Member.updateOrCreate(
        { id: user.id },
        {
          id: user.id,
          firstName: account.firstName,
          lastName: account.lastName,
          roleId,
        }
      )
    }
  }
}
