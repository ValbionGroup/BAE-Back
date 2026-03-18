import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.enum('level', ['info', 'warning', 'error']).notNullable()
      table.string('message').notNullable()
      table.string('method').notNullable()
      table.string('url').notNullable()
      table.string('ip').notNullable()

      table.integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      // Store additional metadata as JSON
      table.json('meta').nullable()

      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
