import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_furnitures'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('product_id')
        .unsigned()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table
        .integer('furniture_id')
        .unsigned()
        .references('id')
        .inTable('furnitures')
        .onDelete('CASCADE')

      table.integer('quantity').unsigned().notNullable()

      table.primary(['product_id', 'furniture_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
