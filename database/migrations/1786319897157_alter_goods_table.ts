import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'goods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Text and not a number: an EAN-13 exceeds the safe integer range and its
      // leading zeros are significant. Nullable because a hand-entered product has
      // no code, and Postgres tolerates several NULLs under the unique index.
      table.string('barcode', 32).nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('barcode')
    })
  }
}
