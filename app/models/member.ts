import { MemberSchema } from '#database/schema'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Order from '#models/order'
import Event from '#models/event'
import Job from '#models/job'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import Restock from '#models/restock'
import Role from '#models/role'

export default class Member extends MemberSchema {
  @belongsTo(() => User, { foreignKey: 'id' })
  declare user: BelongsTo<typeof User>

  @hasMany(() => Order)
  declare takenOrders: HasMany<typeof Order>

  @manyToMany(() => Event, {
    pivotTable: 'member_responses',
    pivotTimestamps: true,
    pivotColumns: ['is_available'],
  })
  declare responses: ManyToMany<typeof Event>

  @manyToMany(() => Job, {
    pivotTable: 'member_job_preferences',
    pivotTimestamps: true,
    pivotColumns: ['rank'],
  })
  declare preferences: ManyToMany<typeof Job>

  @hasMany(() => MemberEventAssignedJob)
  declare assigned: HasMany<typeof MemberEventAssignedJob>

  @hasMany(() => Restock)
  declare restocks: HasMany<typeof Restock>

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>
}
