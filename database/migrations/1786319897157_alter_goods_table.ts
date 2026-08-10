import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the barcode a scanner reads off a package to `goods`.
 *
 * Nullable, because the column has to land on a table that is already
 * populated and most references will never be scanned — a good entered by
 * hand has no barcode and that is not a defect.
 *
 * Unique, because the whole point is the reverse lookup: one code must resolve
 * to exactly one product, or "scan it and I'll tell you what it is" has no
 * answer. Postgres allows many NULLs under a UNIQUE constraint, so the
 * unscannable goods do not collide with each other.
 *
 * Stored as a string, never a number: EAN-13 codes exceed the safe integer
 * range once concatenated, and leading zeros are significant — `0012345678905`
 * and `12345678905` are different products.
 */
export default class extends BaseSchema {
  protected tableName = 'goods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('barcode', 32).nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('barcode')
    })
  }
}
