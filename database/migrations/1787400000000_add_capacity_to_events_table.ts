import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Nombre de précommandes acceptées pour une soirée — **pas** une jauge de
 * fréquentation : on ne compte ici que ce qui a été commandé à l'avance.
 *
 * `0` par défaut, et `0` **ferme** les précommandes. Le défaut est donc un refus,
 * ce qui est voulu : ouvrir une soirée à la précommande est une décision, et
 * l'inverse — toutes les soirées existantes ouvertes d'un coup, sans plafond —
 * exposerait publiquement des menus que personne n'a relus.
 */
export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('capacity').unsigned().notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('capacity')
    })
  }
}
