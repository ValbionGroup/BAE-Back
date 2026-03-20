import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'event_products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('event_id').unsigned().references('id').inTable('events').onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')

      table.integer('quantity').notNullable().defaultTo(1)
      table.integer('price').notNullable().defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.primary(['event_id', 'product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
