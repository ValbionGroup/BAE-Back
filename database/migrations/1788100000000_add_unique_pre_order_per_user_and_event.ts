import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pre_orders'

  async up() {
    this.defer(async (db) => {
      // Les doublons antérieurs à la contrainte, à résorber avant de la poser —
      // la base de dev en portait un, et un `CREATE UNIQUE INDEX` nu ferait
      // échouer le déploiement plutôt que la migration.
      //
      // On garde la ligne qui porte une transaction (donc le paiement), à
      // défaut la plus ancienne, et on **annule** les autres au lieu de les
      // supprimer : une précommande annulée reste lisible et réconciliable,
      // une ligne effacée ne l'est plus.
      await db.rawQuery(`
        UPDATE pre_orders SET status = 'cancelled'
        WHERE id IN (
          SELECT id FROM (
            SELECT id, row_number() OVER (
              PARTITION BY user_id, event_id
              ORDER BY transaction_id ASC NULLS LAST, id ASC
            ) AS position
            FROM pre_orders
            WHERE status <> 'cancelled'
          ) ranked
          WHERE ranked.position > 1
        )
      `)

      // Partiel, et non `UNIQUE (user_id, event_id)` : `placedCounts` ne compte
      // pas les annulées. Une contrainte stricte dirait donc l'inverse du
      // comptage, et bannirait de la soirée le client qui a annulé.
      await db.rawQuery(`
        CREATE UNIQUE INDEX pre_orders_user_event_unique
        ON pre_orders (user_id, event_id)
        WHERE status <> 'cancelled'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS pre_orders_user_event_unique`)
    })
  }
}
