import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le nombre de commandes qu'un QR de catégorie accepte avant de cesser de valoir.
 * `null` = illimité, ce qui garde les catégories existantes inchangées.
 */
export default class extends BaseSchema {
  protected tableName = 'sponsorship_categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('max_orders').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('max_orders')
    })
  }
}
