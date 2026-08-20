import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ouvre la seconde porte d'authentification : le SSO. Elle n'en remplace aucune —
 * l'email/mot de passe du dashboard est conservé tel quel.
 *
 * Les deux colonnes sont nullables, et pour des raisons opposées :
 * `keycloak_sub` parce qu'un compte créé par mot de passe n'a jamais vu l'IdP ;
 * `password` parce qu'un compte né du SSO n'en a pas et ne doit pas s'en inventer.
 *
 * ⚠️ `keycloak_sub` ne remplace **pas** `cas_id`, et les deux doivent coexister :
 * `cas_id` est l'identité métier (à quelle personne de l'annuaire de l'école ce
 * compte correspond) et survit à un ré-import du realm ; `keycloak_sub` est une
 * clé technique liée à ce realm-ci, qu'un ré-import change. C'est donc `cas_id`
 * qui sert à réconcilier un compte existant lors de son premier login SSO.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('keycloak_sub').nullable().unique()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.string('password').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('keycloak_sub')
    })

    // Pas de retour à `notNullable` : des comptes SSO sans mot de passe peuvent
    // exister au moment du rollback, et la contrainte échouerait sur eux.
  }
}
