import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import { FastPassFactory } from '#database/factories/fast_pass_factory'

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    await FastPassFactory.createMany(5)
  }
}
