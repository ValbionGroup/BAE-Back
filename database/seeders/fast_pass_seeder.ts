import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { FastPassFactory } from '#database/factories/fast_pass_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    await FastPassFactory.createMany(10)
  }
}