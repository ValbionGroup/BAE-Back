import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_goods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('rank').notNullable().defaultTo(1)
      table.text('instruction').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rank')
      table.dropColumn('instruction')
    })
  }
}
