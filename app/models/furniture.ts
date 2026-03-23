import { FurnitureSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import Product from '#models/product'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class Furniture extends FurnitureSchema {
  @manyToMany(() => Product, {
    pivotTable: 'product_furnitures',
    pivotColumns: ['quantity'],
    pivotTimestamps: true,
  })
  declare products: ManyToMany<typeof Product>
}
