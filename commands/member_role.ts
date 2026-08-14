import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Member from '#models/member'
import Role from '#models/role'

// The named escape hatch for the two dead ends of the RBAC model:
// `E_RBAC_ABOVE_ACTOR`, when the lone holder of a permission set leaves without
// handing over, and `E_RBAC_LOCKOUT`. Deliberately a command and not a route:
// bypassing one's own guards is an operator action. `db:seed` is no substitute,
// it rewrites the whole matrix from the catalogue.
export default class MemberRole extends BaseCommand {
  static commandName = 'member:role'
  static description = 'Attribue un rôle à un membre en passant outre les gardes RBAC'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Identifiant du membre' })
  declare memberId: string

  @args.string({ description: 'Nom du rôle à attribuer, ou « none » pour retirer le rôle' })
  declare roleName: string

  @flags.boolean({
    description: 'Affiche le changement sans rien écrire',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    const memberId = Number(this.memberId)

    if (!Number.isInteger(memberId) || memberId <= 0) {
      this.logger.error(`Identifiant de membre invalide : ${this.memberId}`)
      this.exitCode = 1
      return
    }

    const member = await Member.query().preload('role').where('id', memberId).first()

    if (!member) {
      this.logger.error(`Membre ${memberId} introuvable.`)
      this.exitCode = 1
      return
    }

    const previous = member.role?.name ?? 'sans rôle'

    if (this.roleName === 'none') {
      if (this.dryRun) {
        this.logger.info(`[dry-run] ${previous} → sans rôle — rien n'a été écrit`)
        return
      }
      member.roleId = null
      await member.save()
      this.logger.success(`Membre ${memberId} : ${previous} → sans rôle`)
      return
    }

    const role = await Role.findBy('name', this.roleName)

    if (!role) {
      const known = await Role.query().select('name').orderBy('name')
      this.logger.error(
        `Rôle « ${this.roleName} » introuvable. Rôles existants : ${known
          .map((entry) => entry.name)
          .join(', ')}`
      )
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      this.logger.info(`[dry-run] ${previous} → ${role.name} — rien n'a été écrit`)
      return
    }

    member.roleId = role.id
    await member.save()
    this.logger.success(`Membre ${memberId} : ${previous} → ${role.name}`)
  }
}
