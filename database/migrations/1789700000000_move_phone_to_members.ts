import { BaseSchema } from '@adonisjs/lucid/schema'

const COPY_TO_MEMBERS = `
  UPDATE members
  SET phone = clients.phone
  FROM clients
  WHERE clients.id = members.id
`

const COPY_TO_CLIENTS = `
  UPDATE clients
  SET phone = members.phone
  FROM members
  WHERE members.id = clients.id
`

/**
 * Le téléphone remonte de `clients` vers `members` : c'est celui du caissier
 * qu'exige l'encaissement Lydia par QR (§10.1), pas celui du client — et un
 * adhérent n'a pas forcément de ligne `clients`.
 *
 * Le retour en arrière perd la liaison des comptes sans ligne `clients` — ils
 * n'avaient nulle part où la ranger avant cette migration.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('members', (table) => {
      table.string('phone', 32).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(COPY_TO_MEMBERS)
    })

    this.schema.alterTable('clients', (table) => {
      table.dropColumn('phone')
    })
  }

  async down() {
    this.schema.alterTable('clients', (table) => {
      table.string('phone', 32).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(COPY_TO_CLIENTS)
    })

    this.schema.alterTable('members', (table) => {
      table.dropColumn('phone')
    })
  }
}
