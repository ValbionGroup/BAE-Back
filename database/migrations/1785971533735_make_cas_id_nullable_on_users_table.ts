import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `cas_id` was `notNullable()` but nothing ever set it outside the test factory,
 * so `POST /v1/auth/signup` failed with a not-null violation on every attempt —
 * `NewAccountController` only assigns `email` and `password`.
 *
 * A self-signed-up account genuinely has no CAS identity, so the column is made
 * nullable rather than filled with a synthetic value that would be
 * indistinguishable from a real CAS identifier once SSO is wired up.
 *
 * The unique index is kept: Postgres treats NULLs as distinct, so any number of
 * non-CAS accounts can coexist while real CAS identifiers stay unique.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('cas_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('cas_id').notNullable().alter()
    })
  }
}
