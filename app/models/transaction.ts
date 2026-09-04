import { TransactionSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import Order from '#models/order'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import PreOrder from '#models/pre_order'
import Subscription from '#models/subscription'

export default class Transaction extends TransactionSchema {
  @hasMany(() => Order)
  declare orders: HasMany<typeof Order>

  @hasMany(() => PreOrder)
  declare preOrder: HasMany<typeof PreOrder>

  @hasMany(() => Subscription)
  declare subscriptions: HasMany<typeof Subscription>
}
