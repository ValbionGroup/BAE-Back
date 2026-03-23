import { JobSchema } from '#database/schema'
import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import Member from '#models/member'

export default class Job extends JobSchema {
  @manyToMany(() => Event, {
    pivotTable: 'event_jobs',
    pivotTimestamps: true,
    pivotColumns: ['count'],
  })
  declare events: ManyToMany<typeof Event>

  @hasMany(() => MemberEventAssignedJob)
  declare assigned: HasMany<typeof MemberEventAssignedJob>

  @manyToMany(() => Member, {
    pivotTable: 'member_job_preferences',
    pivotTimestamps: true,
    pivotColumns: ['rank'],
  })
  declare preferences: ManyToMany<typeof Member>
}
