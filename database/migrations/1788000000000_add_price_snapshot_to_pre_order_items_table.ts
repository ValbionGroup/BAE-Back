import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pre_order_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('list_price_cents').notNullable().defaultTo(0)
    })

    this.schema.alterTable('pre_orders', (table) => {
      table.integer('discount_percent').notNullable().defaultTo(0)
    })

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
