import { FastPassSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class FastPass extends FastPassSchema {
  @manyToMany(() => User)
  declare user: ManyToMany<typeof User>
}
