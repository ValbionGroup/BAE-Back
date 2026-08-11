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
