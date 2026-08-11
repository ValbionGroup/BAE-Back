import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class PointsRecompute extends BaseCommand {
  static commandName = 'points:recompute'
  static description =
    'Recalcule members.points comme la somme des points_delta des affectations consolidées'

  static options: CommandOptions = { startApp: true }

  @flags.boolean({
    description: 'Affiche les écarts sans rien écrire',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    const settledSums = await db
      .from('member_event_assigned_jobs')
      .whereNotNull('settled_at')
      .select('member_id')
      .sum('points_delta as total')
      .groupBy('member_id')

    const expectedByMember = new Map<number, number>(
      settledSums.map((row) => [Number(row.member_id), Number(row.total)])
    )

    const members = await db.from('members').select('id', 'points').orderBy('id')
    const drifted = members
      .map((row) => ({
        id: Number(row.id),
        current: Number(row.points),
        expected: expectedByMember.get(Number(row.id)) ?? 0,
      }))
      .filter((row) => row.current !== row.expected)

    for (const row of drifted) {
      const gap = row.expected - row.current
      this.logger.info(
        `membre ${row.id} : ${row.current} → ${row.expected} (${gap >= 0 ? '+' : ''}${gap})`
      )
    }

    const totalGap = drifted.reduce((sum, row) => sum + (row.expected - row.current), 0)

    if (this.dryRun) {
      this.logger.info(
        `[dry-run] ${drifted.length} membre(s) à corriger, écart total ${totalGap >= 0 ? '+' : ''}${totalGap} — rien n'a été écrit`
      )
      return
    }

    if (drifted.length > 0) {
      await db.transaction(async (trx) => {
        for (const row of drifted) {
          await trx.from('members').where('id', row.id).update({ points: row.expected })
        }
      })
    }

    this.logger.success(
      `${drifted.length} membre(s) corrigé(s), écart total ${totalGap >= 0 ? '+' : ''}${totalGap}`
    )
  }
}
