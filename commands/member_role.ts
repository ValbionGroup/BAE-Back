import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Member from '#models/member'
import Role from '#models/role'

/**
 * Attribue un rôle à un membre depuis la console, en passant outre les deux
 * gardes RBAC des routes HTTP.
 *
 * C'est le chemin de secours nommé pour les deux impasses que le modèle admet :
 *
 *  - la hiérarchie dérivée (`E_RBAC_ABOVE_ACTOR`), quand une personne est seule
 *    à porter un ensemble que personne d'autre n'a et part sans passer la main ;
 *  - l'invariant anti-verrouillage (`E_RBAC_LOCKOUT`).
 *
 * Le remède documenté jusqu'ici était `node ace db:seed`, qui resynchronise la
 * matrice depuis le catalogue et ÉCRASE donc toute édition faite à la main :
 * un remède qui détruit ce qu'on venait de régler. Celle-ci ne touche qu'à une
 * ligne.
 *
 * Délibérément une commande et non une route : contourner ses propres gardes
 * est un geste d'exploitant, fait sciemment, jamais quelque chose qu'un écran
 * doit pouvoir offrir.
 *
 *     node ace member:role 12 Administrateur
 *     node ace member:role 12 none
 *     node ace member:role 12 Administrateur --dry-run
 */
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
