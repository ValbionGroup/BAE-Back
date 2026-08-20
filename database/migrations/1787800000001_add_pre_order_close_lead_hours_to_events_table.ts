import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'events'

  /**
   * Le délai de clôture des précommandes, en **heures avant le début** de la
   * soirée. Ce n'est pas un réglage d'exploitation : c'est le temps dont la
   * cuisine dispose pour produire ce qui a été commandé, et il change d'une
   * soirée à l'autre.
   *
   * ⚠️ **Nullable, et `null` est signifiant** : « suivre la valeur globale »
   * (`PRE_ORDER_CLOSE_LEAD_HOURS`). Une colonne non nulle aurait exigé de
   * reprendre toutes les soirées existantes et de figer aujourd'hui un défaut
   * qui n'a jamais été un choix par soirée.
   */
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('pre_order_close_lead_hours').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pre_order_close_lead_hours')
    })
  }
}
