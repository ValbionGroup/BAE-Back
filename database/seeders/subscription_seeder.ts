import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import FastPass from '#models/fast_pass'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    const users = await User.all()
    const fastPasses = await FastPass.all()

    if (users.length === 0 || fastPasses.length < 2) {
      return
    }

    for (const user of users) {
      await user.related('fastPasses').sync({
        [fastPasses[0].id]: { subscribed_at: DateTime.now() },
        [fastPasses[1].id]: { subscribed_at: DateTime.now() },
      })
    }
  }
}