import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import Job from '#models/job'
import { jobPreferencesValidator } from '#validators/coordination'

// The pivot column is named `rank`; the API exposes it as `preferenceRank`.
// This is a deliberate rename, not a case conversion.
export default class PreferencesController {
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
   * Les postes qu'un membre peut classer.
   *
   * Doublon apparent de `Jobs.index`, et c'est délibéré : celui-là porte
   * `job:read`, une permission d'administration du catalogue. Se classer est un
   * geste personnel, au même titre que `mine()` et `updateMine()` — il n'a rien
   * à exiger de plus qu'un compte. On n'expose ici que ce que le classement
   * réclame, un identifiant et un nom, pas la ligne `jobs` entière.
   */
  async rankableJobs({ serialize }: HttpContext) {
    const jobs = await Job.query().orderBy('id')
    return serialize(jobs.map((job) => ({ id: job.id, name: job.name })))
  }

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
