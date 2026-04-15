import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

export default class MembersController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const members = await Member.query()
    return members
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { firstName, lastName } = request.all()
    const member = new Member()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return member
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const member = await Member.find(params.id)
    return member
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const member = await Member.find(params.id)
    if (!member) {
      throw new Error('Member not found')
    }
    const { firstName, lastName } = request.all()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return member
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const member = await Member.find(params.id)
    if (!member) {
      throw new Error('Member not found')
    }
    await member.delete()
  }
}