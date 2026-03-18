import { LogSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from "#models/user";

export default class Log extends LogSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
