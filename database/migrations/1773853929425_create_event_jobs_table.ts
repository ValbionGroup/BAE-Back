import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'event_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('event_id').unsigned().references('id').inTable('events').onDelete('CASCADE')
      table.integer('job_id').unsigned().references('id').inTable('jobs').onDelete('CASCADE')
      table.integer('count').unsigned().defaultTo(0)

      table.primary(['event_id', 'job_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
