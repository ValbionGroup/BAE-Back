import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Recopiée, et non importée de `#validators/catalog` — où elle n'existe
 * d'ailleurs plus après ce lot. Une migration décrit l'état de la base **au
 * jour où elle est écrite** : `down()` doit pouvoir rendre la colonne telle
 * qu'elle était, y compris sa liste de valeurs.
 */
const STORAGE_METHODS = ['fridge', 'freezer', 'dry', 'cellar'] as const

/**
 * Les lieux de stockage deviennent un référentiel.
 *
 * `goods.storage_method` était un `text` + CHECK posé par `table.enum()` : ses
 * quatre valeurs ne se modifiaient qu'en remplaçant la contrainte, donc par une
 * migration et un déploiement. La page Référentiels tient déjà quatre listes du
 * même genre ; rien ne justifiait que celle-ci reste hors de portée.
 *
 * ⚠️ **Aucun backfill, et c'est une décision.** La table naît vide et les
 * affectations existantes sont perdues. Elle est tenable parce que la colonne
 * était nullable et sans reprise depuis l'origine : `null` s'y lit déjà « pas
 * encore signalé », ce qui reste vrai après coup. Deviner qu'un `'dry'` d'hier
 * correspond à un « Sec » créé demain supposerait que le BAE recrée exactement
 * le même vocabulaire — et le seeder ne fait que le proposer.
 */
export default class extends BaseSchema {
  protected tableName = 'storage_locations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.alterTable('goods', (table) => {
      // ⚠️ `SET NULL` et non `CASCADE` : supprimer un lieu doit **déclasser** les
      // denrées, jamais les détruire. Même choix que `goods.category_id` et
      // `products.product_category_id` — et la raison pour laquelle la
      // suppression n'a pas besoin du garde-fou 409 qu'ont les enseignes.
      table
        .integer('storage_location_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')

      table.dropColumn('storage_method')
    })
  }

  async down() {
    this.schema.alterTable('goods', (table) => {
      table.dropColumn('storage_location_id')
      table.enum('storage_method', STORAGE_METHODS).nullable()
    })

    this.schema.dropTable(this.tableName)
  }
}
