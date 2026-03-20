import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('good_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goods')
        .onDelete('CASCADE')
      table
        .integer('stock_batch_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('stock_batches')
        .onDelete('CASCADE')

      table.decimal('quantity', 10, 2).unsigned().notNullable()
      table.enum('movement_type', ['in', 'out']).notNullable()

      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
