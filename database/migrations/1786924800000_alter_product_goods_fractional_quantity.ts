import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Une recette consomme une **fraction** d'unité d'achat : un hot-dog prend
 * 1/12 de paquet de pains, pas un paquet entier. L'entier rendait cela
 * inexprimable, donc le coût de revient et la sortie de stock à la production
 * étaient tous deux surestimés du facteur de conditionnement.
 *
 * Quatre décimales : 1/12 vaut 0,0833, et deux décimales dériveraient de 4 %
 * sur une fournée de 200. `stock_batches.quantity` est déjà `numeric`.
 */
export default class extends BaseSchema {
  protected tableName = 'product_goods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('quantity', 10, 4).notNullable().alter()
    })
  }

  async down() {
    // Sans cet arrondi, toute quantité fractionnaire refuserait la conversion.
    // Au plafond : ramener 0,0833 à 0 viderait la recette de son ingrédient.
    this.defer(async (db) => {
      await db.rawQuery(`UPDATE ${this.tableName} SET quantity = CEIL(quantity)`)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.integer('quantity').notNullable().alter()
    })
  }
}
