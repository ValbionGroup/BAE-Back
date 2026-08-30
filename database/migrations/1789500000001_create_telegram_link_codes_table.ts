import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le code d'un deep-link `t.me/<bot>?start=<code>`.
 *
 * Une table et non une signature, pour la même raison que `password_reset_tokens` :
 * un code à usage unique réclame un état côté serveur. `used_at` permet en plus de
 * distinguer un lien recliqué — le cas fréquent — d'un lien inconnu.
 *
 * `code_digest` est un HMAC-SHA256 clé par `APP_KEY` : indexable, et une fuite de
 * sauvegarde seule reste inexploitable. Le code en clair ne vit que dans la réponse.
 *
 * La cible est `users` et non `clients` : le chat id vit sur `clients` aujourd'hui,
 * rien ici ne l'y attache.
 */
export default class extends BaseSchema {
  protected tableName = 'telegram_link_codes'

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

      table.string('code_digest', 64).notNullable().unique()

      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
