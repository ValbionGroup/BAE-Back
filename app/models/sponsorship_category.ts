import { SponsorshipCategorySchema } from '#database/schema'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import Product from '#models/product'

export default class SponsorshipCategory extends SponsorshipCategorySchema {
  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @manyToMany(() => Product, {
    pivotTable: 'sponsorship_prices',
    pivotForeignKey: 'category_id',
    pivotTimestamps: true,
    pivotColumns: ['price_cents'],
  })
  declare products: ManyToMany<typeof Product>
}
