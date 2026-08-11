import { BaseSchema } from '@adonisjs/lucid/schema'

// `members.points` is derived from the sum of the settled `points_delta`, which
// `points:recompute` rebuilds: a cascade made that derivation unsound by erasing
// an evening's rows without touching the total, until the next recompute wiped a
// credit that had genuinely been earned. `member_id` stays `CASCADE`: deleting a
// member takes their total with them.
export default class extends BaseSchema {
  protected tableName = 'member_event_assigned_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['event_id'])
      table.dropForeign(['job_id'])
      table.foreign('event_id').references('id').inTable('events').onDelete('RESTRICT')
      table.foreign('job_id').references('id').inTable('jobs').onDelete('RESTRICT')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['event_id'])
      table.dropForeign(['job_id'])
      table.foreign('event_id').references('id').inTable('events').onDelete('CASCADE')
      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE')
    })
  }
}
