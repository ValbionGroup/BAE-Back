import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = ['pending', 'paid', 'refused', 'cancelled', 'expired']

/**
 * Le cycle de vie d'une demande de paiement, **séparé de `transactions`**.
 *
 * Dans ce dépôt, l'existence d'une ligne `transactions` signifie « l'argent est
 * passé » : `transactions_controller`, `event_summary_service` et
 * `receivable_service` la lisent sans filtre. Y écrire un paiement en attente
 * ferait apparaître tout panier abandonné comme une recette — et l'écrasante
 * majorité des demandes créées n'aboutit jamais.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Chaînes contraintes plutôt qu'`enum` : faire évoluer un enum PostgreSQL
      // est une migration lourde, et `transactions.type` en fait déjà les frais.
      table.string('provider').notNullable().defaultTo('lydia')
      table.string('status').notNullable().defaultTo('pending')

      // `request_uuid` de Lydia. Unique : deux paiements ne peuvent pas
      // réclamer la même demande, y compris si `do.json` était rejoué.
      table.string('provider_reference').nullable().unique()
      table.string('provider_request_id').nullable()

      // Notre référence, portée par l'URL de rappel. Opaque et aléatoire.
      table.string('order_ref').notNullable().unique()

      // En centimes : `public_catalog_service` a déjà tranché cette unité pour
      // toute l'API publique, et un entier échappe au piège des `decimal`,
      // rendus en string par le driver.
      table.integer('amount_cents').unsigned().notNullable()
      table.string('currency').notNullable().defaultTo('EUR')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('kind').notNullable()

      // Le panier validé, sérialisé. `text` plutôt qu'une colonne JSON : la
      // lecture est explicite et ne dépend pas du driver.
      table.text('intent').notNullable()

      table.text('mobile_url').nullable()
      table.string('transaction_identifier').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('paid_at').nullable()

      // Renseignée à la confirmation, et seulement là. C'est par elle que se
      // fait la jointure avec la précommande ou la cotisation réglée, toutes
      // deux portant déjà un `transaction_id`.
      table
        .integer('transaction_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('transactions')
        .onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.raw(
      `ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN (${STATUSES.map(
        (status) => `'${status}'`
      ).join(', ')}))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE payments DROP CONSTRAINT payments_status_check`)
    this.schema.dropTable(this.tableName)
  }
}
