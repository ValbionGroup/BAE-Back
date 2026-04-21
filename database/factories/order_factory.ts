import factory from '@adonisjs/lucid/factories'
import Order from '#models/order'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { TransactionFactory } from '#database/factories/transaction_factory'

export const OrderFactory = factory
  .define(Order, async ({ faker }) => {
    return {
      status: faker.helpers.arrayElement(['pending', 'completed', 'cancelled']),
    }
  })
  .relation('takenBy', () => MemberFactory)
  .relation('event', () => EventFactory)
  .relation('transaction', () => TransactionFactory)
  .build()
