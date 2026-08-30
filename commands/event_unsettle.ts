import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

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

      // `settle` fait deux choses — consolider les points **et** passer la soirée
      // à `completed`. Ne défaire que la première laisserait une soirée fermée à
      // l'écran mais rouverte en points : la caisse resterait inatteignable.
      //
      // Déclôturer, c'est reprendre le service : la soirée redevient `ongoing`.
      // Sauf si une autre est déjà ouverte — l'invariant « au plus une » tient
      // aussi ici, et on retombe alors sur `scheduled`, en le disant.
      if (event.status === 'completed') {
        const other = await trx
          .from('events')
          .where('status', 'ongoing')
          .whereNot('id', eventId)
          .first()

        const status = other ? 'scheduled' : 'ongoing'
        await trx.from('events').where('id', eventId).update({ status })

        if (other) {
          this.logger.warning(
            `« ${other.name} » est déjà ouverte : soirée ${eventId} remise en « scheduled » plutôt qu'en « ongoing ».`
          )
        }
      }

      this.logger.success(
        `Soirée ${eventId} déconsolidée : ${settledRows.length} affectation(s), ${deltaByMember.size} membre(s), delta total ${totalDelta}`
      )
    })
  }
}
