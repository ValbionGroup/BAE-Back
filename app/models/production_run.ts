import { ProductionRunSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import Product from '#models/product'
import Member from '#models/member'
import StockMovement from '#models/stock_movement'

export default class ProductionRun extends ProductionRunSchema {
  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => Member)
  declare member: BelongsTo<typeof Member>

  @hasMany(() => StockMovement)
  declare movements: HasMany<typeof StockMovement>
}
