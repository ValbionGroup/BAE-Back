import factory from '@adonisjs/lucid/factories'
import PreOrder from '#models/pre_order'
import { UserFactory } from '#database/factories/user_factory'
import { EventFactory } from '#database/factories/event_factory'
import { TransactionFactory } from '#database/factories/transaction_factory'

export const PreOrderFactory = factory
  .define(PreOrder, async () => {
    return {}
  })
  .relation('user', () => UserFactory)
  .relation('event', () => EventFactory)
  .relation('transaction', () => TransactionFactory)
  .build()
