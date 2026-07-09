import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

export default class MembersController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const members = await Member.query().preload('role')
    return serialize(members)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { firstName, lastName } = request.all()
    const member = new Member()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return serialize(member)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      throw new Error('Member not found')
    }
    return serialize(member)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      throw new Error('Member not found')
    }
    const { firstName, lastName } = request.all()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return serialize(member)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      throw new Error('Member not found')
    }
    await member.delete()
  }
}
