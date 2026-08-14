import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/**
 * De-consolidates an evening: takes its settled deltas back out of
 * `members.points` and clears `settled_at`.
 *
 * The reverse gear of `POST /v1/events/:id/settle`, which the API deliberately
 * does not offer: a close is irreversible from the outside, and a settled
 * evening makes `runMatching` fail with 409. Without this command a mistaken
 * close would be a database incident — which is also why the close itself is
 * now gated behind `event:settle`.
 *
 * Deliberately an ace command, not a route: undoing a close is an operator
 * action, done knowingly, not something the coordination screens should offer
 * by accident.
 *
 * Idempotent: a row with `settled_at` null has never been applied, so a second
 * run finds nothing to give back.
 *
 *     node ace event:unsettle 42
 *     node ace event:unsettle 42 --dry-run
 */
export default class EventUnsettle extends BaseCommand {
  static commandName = 'event:unsettle'
  static description =
    'Déconsolide une soirée : retire ses deltas de members.points et remet settled_at à NULL'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Identifiant de la soirée à déconsolider' })
  declare eventId: string

  @flags.boolean({
    description: 'Affiche ce qui serait rendu sans rien écrire',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    const eventId = Number(this.eventId)

    if (!Number.isInteger(eventId) || eventId <= 0) {
      this.logger.error(`Identifiant de soirée invalide : ${this.eventId}`)
      this.exitCode = 1
      return
    }

    const event = await db.from('events').where('id', eventId).first()

    if (!event) {
      this.logger.error(`Soirée ${eventId} introuvable.`)
      this.exitCode = 1
      return
    }

    await db.transaction(async (trx) => {
      // `forUpdate` closes the same window `settle` closes from the other side:
      // without it a concurrent close could stamp a row between our read and
      // our reversal, and its credit would survive un-refunded.
      const settledRows = await trx
        .from('member_event_assigned_jobs')
        .where('event_id', eventId)
        .whereNotNull('settled_at')
        .select('member_id', 'points_delta')
        .forUpdate()

      const deltaByMember = new Map<number, number>()
      let totalDelta = 0
      for (const row of settledRows) {
        const memberId = Number(row.member_id)
        const delta = Number(row.points_delta)
        deltaByMember.set(memberId, (deltaByMember.get(memberId) ?? 0) + delta)
        totalDelta += delta
      }

      for (const [memberId, delta] of deltaByMember) {
        this.logger.info(
          `membre ${memberId} : ${delta >= 0 ? '−' : '+'}${Math.abs(delta)} rendu(s)`
        )
      }

      if (this.dryRun) {
        this.logger.info(
          `[dry-run] ${settledRows.length} affectation(s), ${deltaByMember.size} membre(s), delta total ${totalDelta} — rien n'a été écrit`
        )
        return
      }

      for (const [memberId, delta] of deltaByMember) {
        if (delta !== 0) {
          await trx.from('members').where('id', memberId).decrement('points', delta)
        }
      }

      await trx
        .from('member_event_assigned_jobs')
        .where('event_id', eventId)
        .whereNotNull('settled_at')
        .update({ settled_at: null })

      this.logger.success(
        `Soirée ${eventId} déconsolidée : ${settledRows.length} affectation(s), ${deltaByMember.size} membre(s), delta total ${totalDelta}`
      )
    })
  }
}
