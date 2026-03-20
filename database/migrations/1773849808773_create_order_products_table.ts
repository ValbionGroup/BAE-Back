import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'order_products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('order_id').unsigned().references('id').inTable('orders').onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')

      table.integer('quantity').notNullable().defaultTo(1)

      table.primary(['order_id', 'product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
