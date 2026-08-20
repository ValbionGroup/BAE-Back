import { TicketSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import TicketMessage from '#models/ticket_message'

export type TicketStatus = 'open' | 'in_progress' | 'closed'

export default class Ticket extends TicketSchema {
  @belongsTo(() => User, { foreignKey: 'authorId' })
  declare author: BelongsTo<typeof User>

  @hasMany(() => TicketMessage)
  declare messages: HasMany<typeof TicketMessage>
}
