import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import { LogFactory } from '#database/factories/log_factory'

export default class extends BaseSeeder {
  async run() {
    const users = await User.query().select('id')

    if (users.length === 0) {
      throw new Error('LogSeeder: no users found. Run UserSeeder first.')
    }

    const pickUserId = () => users[Math.floor(Math.random() * users.length)].id

    await LogFactory.merge(
      Array.from({ length: 50 }, () => ({
        userId: pickUserId(),
      }))
    ).createMany(50)
  }
}
