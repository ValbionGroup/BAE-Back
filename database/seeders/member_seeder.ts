import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { MembersFactory } from '#database/factories/members_factory'

export default class MemberSeeder extends BaseSeeder {
  async run() {
    await MembersFactory.with('user').createMany(10)
  }
}