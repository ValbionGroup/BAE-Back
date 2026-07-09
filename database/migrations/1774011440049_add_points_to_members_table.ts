import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'members'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('points').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('points')
    })
  }
}
