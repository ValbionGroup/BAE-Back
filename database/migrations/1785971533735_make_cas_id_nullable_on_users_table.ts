import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // A self-signed-up account has no CAS identity. The unique index is kept:
      // Postgres treats NULLs as distinct, so non-CAS accounts coexist without
      // getting in each other's way.
      table.string('cas_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('cas_id').notNullable().alter()
    })
  }
}
