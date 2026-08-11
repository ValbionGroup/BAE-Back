import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('event_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('events')
        .onDelete('CASCADE')

      // RESTRICT and not CASCADE: a production run is a record of what was actually
      // made. Deleting the recipe must not erase it — ProductsController.destroy
      // already refuses with 409 E_PRODUCT_IN_USE, and this row joins that guard.
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')

      // In recipe units (200 hot-dogs), never in goods.
      table.integer('quantity').unsigned().notNullable()

      table
        .integer('member_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('members')
        .onDelete('SET NULL')

      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
