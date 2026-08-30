import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ce que le client renseigne sur lui-même. `preparation_note` est distincte de `note`,
 * qui est celle du bureau sur lui.
 *
 * Les colonnes de liaison Telegram arrivent avant leur usage, pour ne pas remigrer. Le
 * chat id revient en **string** du driver `pg`.
 */
export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('preparation_note').nullable()
      table.string('telegram_handle', 64).nullable()
      table.bigInteger('telegram_chat_id').nullable().unique()
      table.timestamp('telegram_linked_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('telegram_linked_at')
      table.dropColumn('telegram_chat_id')
      table.dropColumn('telegram_handle')
      table.dropColumn('preparation_note')
    })
  }
}
