import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'fast_passes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.float('price').unsigned().notNullable()
      table.integer('duration').unsigned().notNullable()
      table.string('description').nullable()
      table.string('label').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
