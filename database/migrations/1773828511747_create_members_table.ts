import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').references('id').inTable('users').onDelete('CASCADE').primary()

      table.string('first_name').notNullable()
      table.string('last_name').notNullable()

      table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
