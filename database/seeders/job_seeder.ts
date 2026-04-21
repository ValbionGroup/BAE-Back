import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { JobFactory } from '#database/factories/job_factory'

export default class extends BaseSeeder {
  async run() {
    await JobFactory.createMany(8)
  }
}
