import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `clients` est à la zone publique ce que `members` est au dashboard : une
 * extension de `users` qui partage sa clé primaire, et non une table de
 * personnes à part. Une même personne peut donc porter les deux lignes.
 *
 * Ne portent ici que les champs propres au public. Le nom vit sur `users`, et
 * l'email aussi.
 */
export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('id')
        .primary()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('phone').nullable()

      // Texte libre plutôt qu'un enum : la maquette y met aussi bien « 2A · Alt. »
      // que « Alumni » ou « Ext. (invité) », qui ne sont pas des promotions au
      // même sens. Contraindre demanderait de savoir laquelle des trois notions
      // on modélise — question ouverte du cahier des charges.
      table.string('promotion').nullable()

      table.date('registered_at').notNullable()

      // Note interne du bureau, avec son auteur et sa date : l'écran l'attribue
      // (« Sarah K. · 12 jan. »), une note anonyme n'y aurait pas sa place.
      table.text('note').nullable()
      table
        .integer('note_author_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('note_written_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
