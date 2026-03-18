import { PreOrderSchema } from '#database/schema'
import {manyToMany} from "@adonisjs/lucid/orm";
import Product from "#models/product";
import type {ManyToMany} from "@adonisjs/lucid/types/relations";

export default class PreOrder extends PreOrderSchema {
  @manyToMany(() => Product, {
    pivotTable: 'pre_order_items',
    pivotColumns: ['quantity', 'received_quantity'],
    pivotTimestamps: true
  })
  declare products: ManyToMany<typeof Product>
}
