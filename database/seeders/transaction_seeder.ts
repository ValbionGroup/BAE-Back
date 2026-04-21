import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { TransactionFactory } from '#database/factories/transaction_factory'

export default class extends BaseSeeder {
  async run() {
    await TransactionFactory.createMany(15)
  }
}
