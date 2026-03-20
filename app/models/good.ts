import { GoodSchema } from '#database/schema'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import Category from '#models/category'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Supplier from '#models/supplier'
import Product from '#models/product'

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
    pivotColumns: ['quantity'],
    pivotTimestamps: true,
  })
  declare products: ManyToMany<typeof Product>
}
