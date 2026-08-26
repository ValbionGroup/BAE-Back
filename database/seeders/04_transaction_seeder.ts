import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import { TransactionFactory } from '#database/factories/transaction_factory'

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    await TransactionFactory.createMany(15)
  }
}
