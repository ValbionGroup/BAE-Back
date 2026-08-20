import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fige le prix d'une précommande au moment de l'achat.
 *
 * Le total était recalculé depuis `event_products.price` à chaque lecture, si
 * bien que retoucher le menu d'une soirée réécrivait le prix des précommandes
 * déjà payées, et qu'un article retiré du menu les faisait tomber à 0.
 *
 * La remise est portée par la précommande et non par la ligne, parce qu'elle
 * s'applique en pourcentage au sous-total avec un arrondi unique : la ventiler
 * par ligne demanderait une règle de répartition des centimes qui n'existe
 * nulle part, et la somme des lignes pourrait diverger du montant encaissé.
 */
export default class extends BaseSchema {
  protected tableName = 'pre_order_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('list_price_cents').notNullable().defaultTo(0)
    })

    this.schema.alterTable('pre_orders', (table) => {
      table.integer('discount_percent').notNullable().defaultTo(0)
    })

    // Les précommandes déjà écrites gardent le prix courant de leur soirée : à
    // défaut elles tomberaient toutes à 0, ce qui est faux et irrattrapable.
    //
    // ⚠️ Les jointures passent par le `WHERE` : Postgres interdit de référencer
    // l'alias de la table mise à jour depuis un `JOIN … ON` du `FROM`.
    //
    // `discount_percent` reste à 0 et n'est pas rempli : le bonus dépendait de
    // l'adhésion au moment de l'achat, que rien ne conserve, et les taux sont
    // des variables d'environnement qui ont pu changer depuis. Ces lignes
    // gardent donc l'affichage qu'elles avaient, faute de pouvoir mieux.
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE pre_order_items poi
        SET list_price_cents = ep.price
        FROM pre_orders po, event_products ep
        WHERE po.id = poi.pre_order_id
          AND ep.event_id = po.event_id
          AND ep.product_id = poi.product_id
      `)
    })
  }

  async down() {
    this.schema.alterTable('pre_orders', (table) => {
      table.dropColumn('discount_percent')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('list_price_cents')
    })
  }
}
