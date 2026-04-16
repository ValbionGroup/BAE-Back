import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.timestamp('subscribed_at').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('fast_pass_id')
        .unsigned()
        .references('id')
        .inTable('fast_passes')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.primary(['user_id', 'fast_pass_id', 'subscribed_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
