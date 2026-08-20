import { ClientSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Client extends ClientSchema {
  public static selfAssignPrimaryKey = true

  @belongsTo(() => User, { foreignKey: 'id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'noteAuthorId' })
  declare noteAuthor: BelongsTo<typeof User>
}
