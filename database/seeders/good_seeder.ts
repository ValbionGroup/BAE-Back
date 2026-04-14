import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { GoodFactory } from '#database/factories/good_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    await GoodFactory.createMany(20)
  }
}