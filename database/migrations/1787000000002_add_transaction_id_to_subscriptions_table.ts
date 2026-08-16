import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rattache une souscription au paiement qui l'a réglée.
 *
 * Sans elle, l'historique des cotisations ne peut afficher qu'un montant tiré du
 * tarif **courant** de la formule : une cotisation payée 12 € en 2023
 * s'afficherait à 15 € le jour où le tarif change. La transaction porte le
 * montant réellement encaissé et son moyen (`type` : `cash | lydia`).
 *
 * Nullable : les souscriptions déjà en base n'ont pas de paiement rattaché, et
 * une cotisation offerte n'en aura jamais.
 */
export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('transaction_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('transactions')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('transaction_id')
    })
  }
}
