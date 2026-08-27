import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Les index que réclament les requêtes chaudes, et qu'aucune migration n'avait
 * posés. Invisibles en développement — quelques dizaines de lignes se trient
 * sans index — et déterminants en production, où ces deux tables ne font que
 * croître.
 *
 * ⚠️ `CREATE INDEX CONCURRENTLY`, et donc `disableTransactions`.
 * `docker-entrypoint.js` lance les migrations **au démarrage du conteneur** :
 * un `CREATE INDEX` ordinaire prend un verrou SHARE qui bloque les écritures, or
 * `request_logger_middleware` écrit dans `logs` à chaque requête. Le déploiement
 * se figerait le temps de la construction. `CONCURRENTLY` ne peut pas s'exécuter
 * dans une transaction, d'où le drapeau.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  async up() {
    // `activity_controller` fait `WHERE actor_id IS NOT NULL ORDER BY
    // occurred_at DESC LIMIT 30` à chaque affichage de l'accueil. Index
    // **partiel** : il épouse exactement ce filtre, et laisse dehors les faits
    // automatiques — les rappels sans auteur, que ce fil exclut par principe.
    this.schema.raw(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_events_feed_idx
         ON activity_events (occurred_at DESC)
         WHERE actor_id IS NOT NULL`
    )

    // Ce que balaie `node ace logs:prune` à chaque nuit.
    this.schema.raw(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_created_at_idx
         ON logs (created_at)`
    )

    // Postgres n'indexe pas les clés étrangères tout seul. `logs.user_id` est en
    // `ON DELETE SET NULL` : sans index, supprimer un compte impose un parcours
    // complet de la table la plus volumineuse de la base.
    this.schema.raw(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_user_id_idx
         ON logs (user_id)`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX CONCURRENTLY IF EXISTS logs_user_id_idx`)
    this.schema.raw(`DROP INDEX CONCURRENTLY IF EXISTS logs_created_at_idx`)
    this.schema.raw(`DROP INDEX CONCURRENTLY IF EXISTS activity_events_feed_idx`)
  }
}
