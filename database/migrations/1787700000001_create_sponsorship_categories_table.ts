import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sponsorship_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('event_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('events')
        .onDelete('CASCADE')
      table.string('label').notNullable()
      // Le jeton du QR n'expire pas : régénérer ce nonce est la seule révocation.
      table.string('qr_nonce').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['event_id', 'label'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
