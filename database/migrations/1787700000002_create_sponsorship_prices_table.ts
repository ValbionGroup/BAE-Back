import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sponsorship_prices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('sponsorship_categories')
        .onDelete('CASCADE')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('price_cents').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.primary(['category_id', 'product_id'])
    })

    // Un prix négatif retournerait la créance en dette du BAE envers le payeur.
    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT sponsorship_prices_non_negative CHECK (price_cents >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
