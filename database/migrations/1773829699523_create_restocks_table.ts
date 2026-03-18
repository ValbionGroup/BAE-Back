import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'restocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('supplier_id')
        .unsigned()
        .references('id')
        .inTable('suppliers')
        .onDelete('SET NULL')

      table.integer('member_id')
        .unsigned()
        .references('id')
        .inTable('members')
        .onDelete('SET NULL')

      table.decimal('total_price', 10, 2).notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
