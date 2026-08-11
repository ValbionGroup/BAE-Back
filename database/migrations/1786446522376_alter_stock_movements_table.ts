import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Nullable: movements written before this lot (discards, seeders) have no run.
      table
        .integer('production_run_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('production_runs')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('production_run_id')
    })
  }
}
