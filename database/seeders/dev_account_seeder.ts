import { BaseSeeder } from '@adonisjs/lucid/seeders'
import app from '@adonisjs/core/services/app'
import Member from '#models/member'
import Role from '#models/role'
import User from '#models/user'
import type { RoleName } from '#database/rbac_catalog'

/**
 * Mot de passe commun aux quatre comptes de développement.
 *
 * Volontairement explicite et sans prétention de secret : ces comptes n'existent
 * que sur un poste de développement, et un mot de passe qu'il faut aller
 * chercher ailleurs ne rendrait pas service. Exporté pour que le test puisse
 * vérifier que la connexion aboutit réellement.
 */
export const DEV_PASSWORD = 'bae-dev-password'

/**
 * Les quatre comptes, et le rôle de chacun.
 *
 * Ce ne sont pas quatre comptes au hasard : ce sont exactement les rôles qu'une
 * vérification à l'écran demande de comparer. `Pole Log` porte `menu:write` et
 * `stock:read`, donc voit et écrit tout ; `Coordinateur` écrit le menu et lit la
 * liste de courses ; `Membre` ne porte que le socle, donc lit le menu et se voit
 * refuser la liste de courses. `Administrateur` sert de passe-partout.
 */
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

/**
 * Quatre comptes connectables, pour le développement uniquement.
 *
 * Pourquoi ce seeder existe : `member_seeder` fabrique ses utilisateurs par
 * `UserFactory`, qui tire `faker.internet.email()` et
 * `faker.internet.password()` — jamais consignés nulle part. Aucun compte semé
 * n'est donc utilisable, et après un `migration:fresh` l'application devient
 * littéralement inaccessible.
 */
export default class extends BaseSeeder {
  /**
   * ⚠️ La garde qui compte, et elle n'est pas décorative.
   *
   * Le déploiement lance `db:seed` : c'est ainsi que les permissions RBAC
   * arrivent en base (cf. `HANDOFF.md` §0 bis et §0 quinquies). Sans cette
   * liste, quatre comptes à identifiants connus — dont un `Administrateur` —
   * seraient créés **en production**. Un commentaire « ne pas déployer » ne
   * protégerait rien : c'est le runner d'Adonis qui doit refuser, et il lit
   * cette propriété.
   */
  static environment = ['development', 'testing']

  async run() {
    // ⚠️ Seconde garde, et c'est celle qui protège vraiment.
    //
    // `static environment` n'est lu que par le runner d'Adonis, quand il
    // *découvre* les fichiers de seeders. Or `main_seeder` fait
    // `new Seeder(this.client).run()` : un appel manuel, qui court-circuite
    // complètement cette vérification. Enregistrer ce seeder dans `main_seeder`
    // sans la garde ci-dessous suffirait donc à créer quatre comptes à
    // identifiants connus en production — la déclaration ne protège que le
    // chemin qu'elle contrôle.
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

      // Idempotent par email : `db:seed` est rejoué à chaque reset, et un seeder
      // qui duplique refabrique la décharge de données que ce lot vient de vider.
      // Le mot de passe est passé en clair : le mixin `withAuthFinder` du modèle
      // le hache au `beforeSave`, exactement comme le fait l'inscription
      // (`NewAccountController` : `User.create({ email, password })`).
      const user = await User.firstOrCreate(
        { email: account.email },
        { email: account.email, password: DEV_PASSWORD }
      )

      // Un membre est un `users` **plus** une ligne `members` qui partage sa clé
      // primaire — `members` n'a pas de colonne `user_id`, sa PK *est* la clé
      // étrangère, d'où `selfAssignPrimaryKey` sur le modèle. Sans cette ligne,
      // `ProfileController.show` déréférence `user.member` et le dashboard
      // répond 500 au démarrage : le compte serait créé mais inutilisable.
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
