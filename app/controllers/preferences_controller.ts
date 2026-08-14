import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import Job from '#models/job'
import { jobPreferencesValidator } from '#validators/coordination'

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

  /**
   * The signed-in member's own ranked preferences, best first.
   *
   * `Member` shares its primary key with `User`, so the caller's member row is
   * the one carrying the same id.
   */
  async mine({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const member = await Member.query().where('id', user.id).preload('preferences').first()

    const preferences = (member?.preferences ?? [])
      .map((job) => ({
        jobId: job.id,
        name: job.name,
        preferenceRank: Number(job.$extras.pivot_rank),
      }))
      .sort((a, b) => a.preferenceRank - b.preferenceRank)

    return serialize(preferences)
  }

  /**
   * Replace the signed-in member's preferences with an ordered list of jobs.
   *
   * Rank comes from the position in `jobIds`, so a client cannot produce gaps,
   * ties or duplicates. `sync` prunes anything absent from the list, which makes
   * an empty array the way to clear the preferences entirely.
   */
  async updateMine({ auth, request, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { jobIds } = await request.validateUsing(jobPreferencesValidator)

    const member = await Member.find(user.id)
    if (!member) {
      return response.notFound({
        error: { code: 'E_ROW_NOT_FOUND', message: 'Aucun profil membre pour ce compte.' },
      })
    }

    if (jobIds.length > 0) {
      const known = await Job.query().whereIn('id', jobIds)
      if (known.length !== jobIds.length) {
        return response.unprocessableEntity({
          error: { code: 'E_UNKNOWN_JOB', message: 'Poste inconnu.' },
        })
      }
    }

    const pivot: Record<number, { rank: number }> = {}
    jobIds.forEach((jobId, index) => {
      pivot[jobId] = { rank: index + 1 }
    })
    await member.related('preferences').sync(pivot)

    await member.load('preferences')
    const preferences = member.preferences
      .map((job) => ({
        jobId: job.id,
        name: job.name,
        preferenceRank: Number(job.$extras.pivot_rank),
      }))
      .sort((a, b) => a.preferenceRank - b.preferenceRank)

    return serialize(preferences)
  }
}
