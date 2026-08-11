import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'member_event_assigned_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dateTime('settled_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('settled_at')
    })
  }
}
