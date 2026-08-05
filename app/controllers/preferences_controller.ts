import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

/**
 * Global read-only index over `member_job_preferences`: how every member ranks
 * every job they applied for.
 *
 * The pivot column is named `rank`; the API exposes it as `preferenceRank`
 * (`preference_rank` once the case converter has run) — this is a deliberate
 * rename, not a case conversion.
 */
export default class PreferencesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const members = await Member.query().preload('preferences').orderBy('id')
    const preferences = members.flatMap((member) =>
      member.preferences.map((job) => ({
        memberId: member.id,
        jobId: job.id,
        preferenceRank: Number(job.$extras.pivot_rank),
      }))
    )
    return serialize(preferences)
  }
}
