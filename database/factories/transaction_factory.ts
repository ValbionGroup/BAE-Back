import factory from '@adonisjs/lucid/factories'
import Transaction from '#models/transaction'

export const TransactionFactory = factory
  .define(Transaction, async ({ faker }) => {
    return {
      amount: faker.finance.amount(),
      type: faker.helpers.arrayElement(['cash', 'lydia']),
    }
  })
  .build()
