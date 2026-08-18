import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fige le prix au moment de la vente.
 *
 * Le total d'une commande était recalculé depuis `event_products.price`, ce qui
 * reste juste tant qu'il n'existe qu'un prix par article. Dès qu'un tarif dépend
 * de l'acheteur, modifier une règle réécrirait le passé.
 *
 * `list_price_cents` est le prix public du moment ; il vaut aujourd'hui toujours
 * `unit_price_cents`, et c'est lui qui portera l'écart quand les remises
 * existeront. Il ne peut pas être reconstitué après coup, d'où sa pose ici.
 */
export default class extends BaseSchema {
  protected tableName = 'order_products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('unit_price_cents').notNullable().defaultTo(0)
      table.integer('list_price_cents').notNullable().defaultTo(0)
    })

    // Les commandes déjà écrites gardent le prix courant de leur soirée : à
    // défaut elles tomberaient toutes à 0, ce qui est faux et irrattrapable.
    //
    // ⚠️ Les jointures passent par le `WHERE` : Postgres interdit de référencer
    // l'alias de la table mise à jour depuis un `JOIN … ON` du `FROM`.
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE order_products op
        SET unit_price_cents = ep.price, list_price_cents = ep.price
        FROM orders o, event_products ep
        WHERE o.id = op.order_id
          AND ep.event_id = o.event_id
          AND ep.product_id = op.product_id
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('unit_price_cents')
      table.dropColumn('list_price_cents')
    })
  }
}
