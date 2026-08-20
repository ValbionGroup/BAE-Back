import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = ['pending', 'paid', 'refused', 'cancelled', 'expired']

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('provider').notNullable().defaultTo('lydia')
      table.string('status').notNullable().defaultTo('pending')

      table.string('provider_reference').nullable().unique()
      table.string('provider_request_id').nullable()

      table.string('order_ref').notNullable().unique()

      table.integer('amount_cents').unsigned().notNullable()
      table.string('currency').notNullable().defaultTo('EUR')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('kind').notNullable()

      table.text('intent').notNullable()

      table.text('mobile_url').nullable()
      table.string('transaction_identifier').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('paid_at').nullable()

      table
        .integer('transaction_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('transactions')
        .onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.raw(
      `ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN (${STATUSES.map(
        (status) => `'${status}'`
      ).join(', ')}))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE payments DROP CONSTRAINT payments_status_check`)
    this.schema.dropTable(this.tableName)
  }
}
