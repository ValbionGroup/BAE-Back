import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ce qui a été retiré d'une commande, et pourquoi.
 *
 * Une remise portée par le seul total serait indistinguable d'un prix plus bas :
 * le bilan a besoin de lire « CA brut / remises / net », pas seulement l'encaissé.
 *
 * `product_id` nul désigne une remise sur toute la commande. `label` est recopié
 * et non dérivé : il doit rester lisible même si la règle qui l'a produit change
 * ou disparaît.
 */
export default class extends BaseSchema {
  protected tableName = 'order_discounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('order_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('label').notNullable()
      table.integer('amount_cents').notNullable()
      table
        .integer('applied_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['order_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
