import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'member_event_assigned_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('member_id').unsigned().references('id').inTable('members').onDelete('CASCADE')
      table.integer('event_id').unsigned().references('id').inTable('events').onDelete('CASCADE')
      table.integer('job_id').unsigned().references('id').inTable('jobs').onDelete('CASCADE')

      table.primary(['member_id', 'event_id', 'job_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
