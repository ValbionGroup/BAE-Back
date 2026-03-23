import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_goods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('good_id').unsigned().references('id').inTable('goods').onDelete('CASCADE')

      table.integer('quantity').unsigned().notNullable()

      table.primary(['product_id', 'good_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
