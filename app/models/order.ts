import { OrderSchema } from '#database/schema'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import Member from '#models/member'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import Product from '#models/product'
import Transaction from '#models/transaction'
import User from '#models/user'

export default class Order extends OrderSchema {
  /** Le membre qui a **pris** la commande au comptoir — pas l'acheteur. */
  @belongsTo(() => Member)
  declare takenBy: BelongsTo<typeof Member>

  /**
   * L'**acheteur**, quand il a été identifié (QR ou recherche par nom) ; `null`
   * pour une commande anonyme, qui est le cas courant.
   *
   * Pointe sur `users` et non `members` parce que `members.id` **est** `users.id`
   * et que la future table `clients` partagera la même clé : le jour où elle
   * existe, seule la contrainte change. Voir la migration
   * `alter_orders_kitchen_states_and_client`.
   */
  @belongsTo(() => User, { foreignKey: 'clientId' })
  declare client: BelongsTo<typeof User>

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
