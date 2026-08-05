import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ip_address').nullable()
      table.string('user_agent').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ip_address')
      table.dropColumn('user_agent')
    })
  }
}
