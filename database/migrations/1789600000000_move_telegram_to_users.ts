import { BaseSchema } from '@adonisjs/lucid/schema'

const COPY_TO_USERS = `
  UPDATE users
  SET telegram_handle = clients.telegram_handle,
      telegram_chat_id = clients.telegram_chat_id,
      telegram_linked_at = clients.telegram_linked_at
  FROM clients
  WHERE clients.id = users.id
`

const COPY_TO_CLIENTS = `
  UPDATE clients
  SET telegram_handle = users.telegram_handle,
      telegram_chat_id = users.telegram_chat_id,
      telegram_linked_at = users.telegram_linked_at
  FROM users
  WHERE users.id = clients.id
`

/**
 * Telegram remonte de `clients` vers `users`. La plupart des notifications
 * s'adressent au bureau, et un membre n'a pas forcément de ligne `clients` :
 * la porter là revenait à réserver le bot à ceux qui n'en ont pas besoin.
 *
 * Le retour en arrière perd la liaison des comptes sans ligne `clients` — ils
 * n'avaient nulle part où la ranger avant cette migration.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('telegram_handle', 64).nullable()
      table.bigInteger('telegram_chat_id').nullable().unique()
      table.timestamp('telegram_linked_at').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(COPY_TO_USERS)
    })

    this.schema.alterTable('clients', (table) => {
      table.dropColumn('telegram_linked_at')
      table.dropColumn('telegram_chat_id')
      table.dropColumn('telegram_handle')
    })
  }

  async down() {
    this.schema.alterTable('clients', (table) => {
      table.string('telegram_handle', 64).nullable()
      table.bigInteger('telegram_chat_id').nullable().unique()
      table.timestamp('telegram_linked_at').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(COPY_TO_CLIENTS)
    })

    this.schema.alterTable('users', (table) => {
      table.dropColumn('telegram_linked_at')
      table.dropColumn('telegram_chat_id')
      table.dropColumn('telegram_handle')
    })
  }
}
