import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { errors as vineErrors } from '@vinejs/vine'
import Member from '#models/member'
import Role from '#models/role'
import User from '#models/user'
import { memberCreateValidator } from '#validators/member'

// La contrepartie de `POST /members`, qui répond 501 tant que les invitations
// n'existent pas : créer un membre, c'est créer un compte. En attendant, c'est un
// geste d'exploitation, donc une commande.
//
// Elle promeut aussi un compte déjà là, seule issue pour qui se connecte par le
// SSO et que `sso_provisioning_service.provision()` renvoie `not-a-member`.
//
// Aucun appel aux gardes RBAC, contrairement à `MembersController.update` :
// ajouter un membre ne retire de permission à personne, `assertNoLockout` n'a
// donc rien à protéger ici.
export default class MemberCreate extends BaseCommand {
  static commandName = 'member:create'
  static description = 'Crée un membre, ou promeut un compte existant en membre'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Adresse e-mail du compte' })
  declare email: string

  @flags.string({
    description: 'Nom du rôle à attribuer ; à défaut le membre naît sans rôle',
  })
  declare role?: string

  @flags.string({ description: 'Prénom, écrit sur le compte' })
  declare firstName?: string

  @flags.string({ description: 'Nom de famille, écrit sur le compte' })
  declare lastName?: string

  @flags.string({
    description: 'Mot de passe ; à défaut le compte ne se connecte que par le SSO',
  })
  declare password?: string

  @flags.boolean({
    description: 'Affiche ce qui serait écrit sans rien écrire',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    let payload: { email: string; password?: string }

    try {
      payload = await memberCreateValidator.validate({
        email: this.email,
        password: this.password,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        for (const message of error.messages) {
          this.logger.error(`${message.field} : ${message.message}`)
        }
        this.exitCode = 1
        return
      }
      throw error
    }

    let role: Role | null = null

    if (this.role !== undefined) {
      role = await Role.findBy('name', this.role)

      if (role === null) {
        const known = await Role.query().select('name').orderBy('name')
        this.logger.error(
          `Rôle « ${this.role} » introuvable. Rôles existants : ${known
            .map((entry) => entry.name)
            .join(', ')}`
        )
        this.exitCode = 1
        return
      }
    }

    const existing = await User.findBy('email', payload.email)

    if (existing !== null) {
      if ((await Member.find(existing.id)) !== null) {
        this.logger.error(`${payload.email} est déjà membre.`)
        this.exitCode = 1
        return
      }

      if (payload.password !== undefined && existing.password !== null) {
        this.logger.error(
          `${payload.email} a déjà un mot de passe ; cette commande ne le remplace pas.`
        )
        this.exitCode = 1
        return
      }
    }

    const roleLabel = role?.name ?? 'sans rôle'
    const action = existing === null ? 'création' : 'promotion'

    if (this.dryRun) {
      this.logger.info(
        `[dry-run] ${action} de ${payload.email} (${roleLabel}) — rien n'a été écrit`
      )
      return
    }

    const memberId = await db.transaction(async (trx) => {
      const user = existing ?? new User()
      user.useTransaction(trx)
      user.email = payload.email

      if (payload.password !== undefined) {
        user.password = payload.password
      }

      // `??=` et non une affectation sèche : le nom vit sur `users` et vaut
      // peut-être déjà pour une cliente. On comble ce qui manque, on n'écrase
      // rien. Sur un compte neuf la colonne vaut `undefined`, que `??=` traite
      // comme absente — un test `=== null` laisserait les drapeaux sans effet.
      user.firstName ??= this.firstName ?? null
      user.lastName ??= this.lastName ?? null
      user.password ??= null

      await user.save()

      await Member.create({ id: user.id, roleId: role?.id ?? null }, { client: trx })

      return user.id
    })

    this.logger.success(`Membre ${memberId} — ${action} de ${payload.email} (${roleLabel})`)
  }
}
