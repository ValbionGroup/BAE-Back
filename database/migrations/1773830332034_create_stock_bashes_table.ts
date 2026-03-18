import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_bashes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.date('expiration_date').nullable()
      table.string('label').notNullable()
      table.decimal('quantity', 10, 2).unsigned().notNullable()

      table.integer('good_id')
        .unsigned()
        .references('id')
        .inTable('goods')
        .onDelete('CASCADE')
      table.integer('restock_id')
        .unsigned()
        .references('id')
        .inTable('restocks')
        .onDelete('CASCADE')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
