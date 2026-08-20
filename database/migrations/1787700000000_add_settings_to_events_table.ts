import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('expected_attendees').unsigned().nullable()
      // Non nul = la prise en charge est active sur cette soirée.
      table.string('payer_name').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('expected_attendees')
      table.dropColumn('payer_name')
    })
  }
}
