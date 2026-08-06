import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `settled_at` marks an assignment whose `points_delta` has already been added
 * to `members.points`.
 *
 * The marker is per ROW, not per event: it keeps the close idempotent line by
 * line, survives a partial unassignment, and tells `destroy` whether it has
 * anything to refund. Null = the delta was never applied.
 */
export default class extends BaseSchema {
  protected tableName = 'member_event_assigned_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dateTime('settled_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('settled_at')
    })
  }
}
