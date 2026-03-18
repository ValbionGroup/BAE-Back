import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'member_responses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('member_id').unsigned().references('id').inTable('members').onDelete('CASCADE')
      table.integer('event_id').unsigned().references('id').inTable('events').onDelete('CASCADE')
      table.boolean('is_available').defaultTo(false).notNullable()

      table.primary(['member_id', 'event_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
