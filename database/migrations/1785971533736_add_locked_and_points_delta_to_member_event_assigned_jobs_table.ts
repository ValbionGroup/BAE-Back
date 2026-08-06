import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'member_event_assigned_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('locked').notNullable().defaultTo(false)
      table.integer('points_delta').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('locked')
      table.dropColumn('points_delta')
    })
  }
}
