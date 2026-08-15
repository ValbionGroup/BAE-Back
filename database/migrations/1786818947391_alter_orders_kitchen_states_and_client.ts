import { BaseSchema } from '@adonisjs/lucid/schema'

const OLD_STATUSES = ['pending', 'completed', 'cancelled']
const NEW_STATUSES = ['pending', 'in_progress', 'ready', 'completed', 'cancelled']

/** Nom auto-attribué par Postgres au CHECK inline que produit `table.enum()`. */
const STATUS_CHECK = 'orders_status_check'

function checkClause(statuses: string[]): string {
  return statuses.map((status) => `'${status}'`).join(', ')
}

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    // `table.enum()` de Knex (sans `useNative`) ne crée pas un type enum Postgres
    // mais une colonne `text` assortie d'un CHECK inline. Élargir les valeurs
    // permises se fait donc en remplaçant la contrainte, pas en altérant un type.
    this.schema.raw(`ALTER TABLE orders DROP CONSTRAINT ${STATUS_CHECK}`)
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT ${STATUS_CHECK} CHECK (status IN (${checkClause(NEW_STATUSES)}))`
    )

    this.schema.alterTable(this.tableName, (table) => {
      // `client_id` désigne **l'acheteur**, quand il a été identifié au comptoir —
      // à ne pas confondre avec `member_id`, qui dit quel membre a *pris* la
      // commande. Les deux coexistent et répondent à deux questions distinctes.
      //
      // La cible est `users` et non `members` : `members.id` **est** `users.id`
      // (clé primaire partagée), et la future table `clients` suivra le même
      // patron. Nommer la colonne d'après son rôle métier plutôt que d'après sa
      // cible du moment permettra de la repointer vers `clients` par un simple
      // changement de contrainte, sans migration de données ni renommage.
      // C'est aussi le niveau qu'utilisent déjà `pre_orders.user_id` et
      // `subscriptions.user_id`.
      table
        .integer('client_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        // Supprimer un compte ne doit pas effacer l'historique de vente, comme
        // pour `member_id`.
        .onDelete('SET NULL')
    })
  }

  async down() {
    // Les deux états ajoutés n'existent pas dans l'ancienne contrainte : sans ce
    // repli, le CHECK restauré échouerait sur les lignes qui les portent.
    this.schema.raw(`UPDATE orders SET status = 'pending' WHERE status IN ('in_progress', 'ready')`)

    this.schema.raw(`ALTER TABLE orders DROP CONSTRAINT ${STATUS_CHECK}`)
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT ${STATUS_CHECK} CHECK (status IN (${checkClause(OLD_STATUSES)}))`
    )

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('client_id')
    })
  }
}
