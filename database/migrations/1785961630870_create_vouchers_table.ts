import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vouchers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('supplier_id')
        .unsigned()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')

      table.decimal('value', 10, 2).notNullable()
      table.date('expires_at').notNullable()
      table.string('condition').nullable() // e.g. 'à partir de 80 €'
      table.timestamp('used_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
