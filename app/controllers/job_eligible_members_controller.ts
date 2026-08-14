import type { HttpContext } from '@adonisjs/core/http'
import Job from '#models/job'
import Member from '#models/member'
import { jobEligibleMemberValidator } from '#validators/coordination'

export default class JobEligibleMembersController {
  async index({ serialize }: HttpContext) {
    const jobs = await Job.query().preload('eligibleMembers').orderBy('id')
    const rows = jobs.flatMap((job) =>
      job.eligibleMembers.map((member) => ({ jobId: job.id, memberId: member.id }))
    )
    return serialize(rows)
  }

  async store({ request, serialize }: HttpContext) {
    const { jobId, memberId } = await request.validateUsing(jobEligibleMemberValidator)
    const job = await Job.findOrFail(jobId)
    await Member.findOrFail(memberId)
    await job.related('eligibleMembers').sync({ [memberId]: {} }, false)
    return serialize({ jobId, memberId })
  }

  async destroy({ request, response }: HttpContext) {
    const { jobId, memberId } = await jobEligibleMemberValidator.validate(request.qs())
    const job = await Job.findOrFail(jobId)
    await job.related('eligibleMembers').detach([memberId])
    return response.noContent()
  }
}
