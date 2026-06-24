import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { ProductFactory } from '#database/factories/product_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    await ProductFactory.createMany(10)
  }
}
