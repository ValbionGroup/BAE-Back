import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Les jetons de réinitialisation de mot de passe.
 *
 * Une table et non un JWT signé : un jeton de reset doit être **à usage unique**,
 * ce qu'aucune signature ne sait exprimer sans un état côté serveur. Dès qu'une
 * ligne est nécessaire, le JWT n'ajoute que de la longueur et un second mode de
 * panne (la rotation de clé). La ligne offre en plus `used_at`, donc une trace.
 *
 * `token_digest` est un HMAC-SHA256 clé par `APP_KEY` — même raisonnement que les
 * codes de secours : indexable, et une fuite de la base seule ne rend rien.
 */
export default class extends BaseSchema {
  protected tableName = 'password_reset_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('token_digest', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      // Une demande neuve doit périmer les précédentes du même compte : c'est ce
      // parcours-là qu'on indexe, pas la recherche par jeton (déjà unique).
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
