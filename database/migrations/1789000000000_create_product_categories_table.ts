import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.alterTable('products', (table) => {
      // ⚠️ `SET NULL` et non `CASCADE` : supprimer une catégorie doit **déclasser**
      // les recettes, jamais les détruire. Même choix que `goods.category_id` —
      // et la raison pour laquelle la suppression n'a pas besoin du garde-fou
      // 409 qu'ont les enseignes.
      table
        .integer('product_category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_categories')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('products', (table) => {
      table.dropColumn('product_category_id')
    })
    this.schema.dropTable(this.tableName)
  }
}
