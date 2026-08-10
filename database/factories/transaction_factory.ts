import factory from '@adonisjs/lucid/factories'
import Transaction from '#models/transaction'

export const TransactionFactory = factory
  .define(Transaction, async ({ faker }) => {
    return {
      amount: faker.finance.amount(),
      // `transactions.type` est un enum contraint en base
      // (`transactions_type_check` : cash | lydia). Les valeurs credit/debit/refund
      // qui figuraient ici étaient refusées à l'insertion, ce qui faisait échouer
      // TransactionSeeder — et donc main_seeder, qui l'appelle à son étape 1, donc
      // toute la chaîne de seeding orchestrée.
      type: faker.helpers.arrayElement(['cash', 'lydia']),
    }
  })
  .build()
