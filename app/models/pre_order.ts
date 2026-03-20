import { PreOrderSchema } from '#database/schema'
import {belongsTo, manyToMany} from '@adonisjs/lucid/orm'
import Product from '#models/product'
import type {BelongsTo, ManyToMany} from '@adonisjs/lucid/types/relations'
import Event from "#models/event";
import User from "#models/user";
import Transaction from "#models/transaction";

export default class PreOrder extends PreOrderSchema {
  @manyToMany(() => Product, {
    pivotTable: 'pre_order_items',
    pivotColumns: ['quantity', 'received_quantity'],
    pivotTimestamps: true,
  })
  declare products: ManyToMany<typeof Product>

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
