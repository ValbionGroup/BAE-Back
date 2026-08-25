import factory from '@adonisjs/lucid/factories'
import Transaction from '#models/transaction'

export const TransactionFactory = factory
  .define(Transaction, async ({ faker }) => {
    return {
      amount: faker.number.int({ min: 100, max: 15000 }),
      type: faker.helpers.arrayElement(['cash', 'lydia']),
    }
  })
  .build()
