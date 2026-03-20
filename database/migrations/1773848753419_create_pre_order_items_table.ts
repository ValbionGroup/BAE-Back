import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pre_order_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('pre_order_id')
        .unsigned()
        .references('id')
        .inTable('pre_orders')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('quantity').unsigned().notNullable()
      table.integer('received_quantity').unsigned().notNullable().defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.check('quantity >= 0')
      table.check('received_quantity >= 0')

      table.primary(['pre_order_id', 'product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
