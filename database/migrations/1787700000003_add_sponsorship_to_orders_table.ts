import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('sponsorship_category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('sponsorship_categories')
        .onDelete('SET NULL')
      // Recopiés : la catégorie peut disparaître et le payeur de la soirée reste
      // éditable, or un justificatif réédité ne doit pas changer de débiteur.
      table.string('sponsorship_category_label').nullable()
      table.string('payer_name').nullable()

      table.index(['event_id', 'sponsorship_category_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['event_id', 'sponsorship_category_id'])
      table.dropColumn('sponsorship_category_id')
      table.dropColumn('sponsorship_category_label')
      table.dropColumn('payer_name')
    })
  }
}
