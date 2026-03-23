import { OrderSchema } from '#database/schema'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import Member from '#models/member'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import Product from '#models/product'
import Transaction from '#models/transaction'

export default class Order extends OrderSchema {
  @belongsTo(() => Member)
  declare takenBy: BelongsTo<typeof Member>

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @manyToMany(() => Product, {
    pivotTable: 'order_products',
    pivotColumns: ['quantity'],
  })
  declare products: ManyToMany<typeof Product>
}
