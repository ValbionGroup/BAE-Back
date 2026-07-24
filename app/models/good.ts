import { GoodSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import Category from '#models/category'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Supplier from '#models/supplier'
import Product from '#models/product'
import StockMovement from '#models/stock_movement'
import StockBatch from '#models/stock_batch'

export default class Good extends GoodSchema {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @manyToMany(() => Supplier, {
    pivotTimestamps: true,
    pivotColumns: ['price'],
    pivotTable: 'good_suppliers',
  })
  declare suppliers: ManyToMany<typeof Supplier>

  @manyToMany(() => Product, {
    pivotTable: 'product_goods',
    pivotColumns: ['quantity', 'rank', 'instruction'],
    pivotTimestamps: true,
  })
  declare products: ManyToMany<typeof Product>

  @hasMany(() => StockMovement)
  declare stockMovement: HasMany<typeof StockMovement>

  @hasMany(() => StockBatch)
  declare stockBatch: HasMany<typeof StockBatch>
}
