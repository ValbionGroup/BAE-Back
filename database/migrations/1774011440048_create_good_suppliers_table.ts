import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'good_suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table
        .integer('good_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goods')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table.decimal('price', 10, 2).notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
