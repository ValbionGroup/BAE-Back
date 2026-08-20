import { EventSchema } from '#database/schema'
import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import Product from '#models/product'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Member from '#models/member'
import Job from '#models/job'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import PreOrder from '#models/pre_order'
import Order from '#models/order'
import SponsorshipCategory from '#models/sponsorship_category'

export default class Event extends EventSchema {
  @manyToMany(() => Product, {
    pivotTable: 'event_products',
    pivotTimestamps: true,
    pivotColumns: ['quantity', 'price'],
  })
  declare products: ManyToMany<typeof Product>

  @manyToMany(() => Member, {
    pivotTable: 'member_responses',
    pivotTimestamps: true,
    pivotColumns: ['is_available'],
  })
  declare members: ManyToMany<typeof Member>

  @manyToMany(() => Job, {
    pivotTable: 'event_jobs',
    pivotTimestamps: true,
    pivotColumns: ['count'],
  })
  declare jobs: ManyToMany<typeof Job>

  @hasMany(() => MemberEventAssignedJob)
  declare assigned: HasMany<typeof MemberEventAssignedJob>

  @hasMany(() => PreOrder)
  declare preOrders: HasMany<typeof PreOrder>

  @hasMany(() => Order)
  declare orders: HasMany<typeof Order>

  @hasMany(() => SponsorshipCategory)
  declare sponsorshipCategories: HasMany<typeof SponsorshipCategory>
}
