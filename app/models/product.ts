import { ProductSchema } from '#database/schema'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Furniture from '#models/furniture'
import Good from '#models/good'
import Order from '#models/order'
import Event from '#models/event'
import PreOrder from '#models/pre_order'
import ProductCategory from '#models/product_category'

export default class Product extends ProductSchema {
  /** La catégorie de vente, celle qui décide de l'onglet de la caisse. */
  @belongsTo(() => ProductCategory)
  declare productCategory: BelongsTo<typeof ProductCategory>

  @manyToMany(() => PreOrder, {
    pivotTable: 'pre_order_items',
    pivotColumns: ['quantity', 'received_quantity'],
    pivotTimestamps: true,
  })
  declare preOrders: ManyToMany<typeof PreOrder>

  @manyToMany(() => Event, {
    pivotTable: 'event_products',
    pivotTimestamps: true,
    pivotColumns: ['quantity', 'price'],
  })
  declare events: ManyToMany<typeof Event>

  @manyToMany(() => Order, {
    pivotTable: 'order_products',
    pivotColumns: ['quantity'],
  })
  declare orders: ManyToMany<typeof Order>

  @manyToMany(() => Furniture, {
    pivotTable: 'product_furnitures',
    pivotColumns: ['quantity'],
    pivotTimestamps: true,
  })
  declare furnitures: ManyToMany<typeof Furniture>

  @manyToMany(() => Good, {
    pivotTable: 'product_goods',
    pivotColumns: ['quantity', 'rank', 'instruction'],
    pivotTimestamps: true,
  })
  declare goods: ManyToMany<typeof Good>
}
