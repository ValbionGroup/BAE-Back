import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  /**
   * L'`id_token` reçu au callback SSO, conservé pour servir d'`id_token_hint` au
   * logout RP-initiated : sans lui Keycloak intercale un écran de confirmation.
   *
   * Sur cette table parce que sa ligne **est** la connexion — sa valeur voyage
   * dans le cookie `bae_token`. Le jeton naît et meurt donc avec la session,
   * sans une ligne de nettoyage.
   *
   * `text` et non `string` : un id_token RS256 dépasse volontiers les 255
   * caractères d'un `varchar` par défaut. Nullable est le cas **nominal** — un
   * compte authentifié par mot de passe n'en a jamais.
   */
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('sso_id_token').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('sso_id_token')
    })
  }
}
