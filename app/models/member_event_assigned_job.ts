import { MemberEventAssignedJobSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import Job from '#models/job'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import Member from '#models/member'

export default class MemberEventAssignedJob extends MemberEventAssignedJobSchema {
  @belongsTo(() => Job)
  declare job: BelongsTo<typeof Job>

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => Member)
  declare member: BelongsTo<typeof Member>
}
