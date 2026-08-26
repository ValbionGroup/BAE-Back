import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Sort les codes-barres de `goods` vers leur propre table.
 *
 * Un même aliment se vend sous plusieurs conditionnements, donc sous plusieurs
 * EAN : une colonne ne peut en porter qu'un, et le scanner n'avait d'autre issue
 * que de créer un doublon au second code.
 *
 * `code` reste **unique au global** et non par denrée : c'est cette contrainte
 * qui garantit qu'un code lu désigne une seule fiche. La perdre rendrait le scan
 * ambigu, ce qui est précisément ce que le scanner ne peut pas gérer.
 */
export default class extends BaseSchema {
  protected tableName = 'good_barcodes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('good_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goods')
        .onDelete('CASCADE')
      // Texte et non nombre : un EAN-13 dépasse l'entier sûr et ses zéros de
      // tête sont significatifs.
      table.string('code', 32).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    // Recopie par le query builder, comme les autres reprises du dépôt : la
    // syntaxe d'`INSERT … SELECT` diffère entre les deux connexions configurées.
    this.defer(async (db) => {
      const goods = await db.from('goods').select('id', 'barcode').whereNotNull('barcode')
      const now = new Date()
      for (const good of goods) {
        await db
          .table('good_barcodes')
          .insert({ good_id: good.id, code: good.barcode, created_at: now, updated_at: now })
      }
    })

    this.schema.alterTable('goods', (table) => {
      table.dropColumn('barcode')
    })
  }

  /**
   * ⚠️ Retour arrière **avec perte** : la colonne ne peut porter qu'un code, donc
   * seul le plus ancien de chaque denrée est restitué. Les suivants disparaissent
   * — c'est inhérent au format d'origine, pas un oubli.
   */
  async down() {
    this.schema.alterTable('goods', (table) => {
      table.string('barcode', 32).nullable().unique()
    })

    this.defer(async (db) => {
      // `min(id)` et non `min(code)` : c'est le premier code **posé** qu'on
      // restitue, pas le plus petit numériquement.
      const firstIds = await db.from('good_barcodes').min('id as id').groupBy('good_id')
      const rows = await db
        .from('good_barcodes')
        .select('good_id', 'code')
        .whereIn(
          'id',
          firstIds.map((row: { id: number }) => row.id)
        )
      for (const row of rows) {
        await db.from('goods').where('id', row.good_id).update({ barcode: row.code })
      }
    })

    this.schema.dropTable(this.tableName)
  }
}
