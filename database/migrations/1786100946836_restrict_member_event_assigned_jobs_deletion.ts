import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Turns the `event_id` and `job_id` foreign keys of the assignment rows from
 * `CASCADE` into `RESTRICT`.
 *
 * Since D7 `members.points` is DERIVED from the settled `points_delta` — that
 * is what `points:recompute` rebuilds. A cascade made the derivation unsound:
 * deleting an evening erased its rows without touching `members.points`, so the
 * total stood until the recompute, which then wiped a credit that had really
 * been earned. The safety net was the tool that destroyed the ledger.
 *
 * `RESTRICT` makes the database the last line of that guarantee. The
 * controllers delete the UNSETTLED rows of an evening or a job explicitly
 * before removing it — an unsettled delta never reached anybody's total, so it
 * has nothing to give back — and refuse outright when a settled row remains.
 * `node ace event:unsettle` is the way through: it hands the credit back
 * knowingly, and then the deletion goes ahead.
 *
 * `member_id` stays `CASCADE`: deleting a member takes their `members.points`
 * with them, so nothing is left to drift.
 */
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
