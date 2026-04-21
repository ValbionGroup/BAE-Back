import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { FastPassFactory } from '#database/factories/fast_pass_factory'

export default class extends BaseSeeder {
  async run() {
    await FastPassFactory.createMany(5)
  }
}
