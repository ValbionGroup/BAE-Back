import factory from '@adonisjs/lucid/factories'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'

export const MemberEventAssignedJobFactory = factory
  .define(MemberEventAssignedJob, async () => {
    return {}
  })
  .relation('member', () => MemberFactory)
  .relation('event', () => EventFactory)
  .relation('job', () => JobFactory)
  .build()
