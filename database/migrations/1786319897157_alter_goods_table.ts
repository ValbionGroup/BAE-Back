import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le code-barres qu'un scanner lit sur un emballage.
 *
 * Nullable : la colonne arrive sur une table peuplée et un produit saisi à la
 * main n'a pas de code. Unique : un code doit résoudre vers exactement un
 * produit — Postgres tolère plusieurs NULL, donc les produits non scannables ne
 * se gênent pas. Texte et non nombre : un EAN-13 dépasse l'entier sûr et ses
 * zéros de tête sont significatifs.
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
