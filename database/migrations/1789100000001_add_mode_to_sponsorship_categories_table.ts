import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Distingue la prise en charge **externe** (refacturée à un tiers payeur) de la
 * prise en charge **interne** (offerte par le BAE, jamais recouvrée).
 *
 * Le défaut `external` reprend telle quelle la sémantique des catégories
 * existantes — elles supposaient toutes un payeur, puisque leur création
 * l'exigeait. Aucun backfill à écrire.
 */
export default class extends BaseSchema {
  protected tableName = 'sponsorship_categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('mode', 16).notNullable().defaultTo('external')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('mode')
    })
  }
}
