import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

export default class MembersController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Member.query().preload('user').preload('role')
    // return Member.all()
  }

  /**
   * Display form to create a new record
   */
  async create({}: HttpContext) {
    return Member.create({
      firstName: 'John',
      lastName: 'Doe',
    })
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {}

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return Member.query().where('id', params.id).preload('user').preload('role').firstOrFail()
    // return Member.findOrFail(params.id)
  }

  /**
   * Edit individual record
   */
  async edit({ params }: HttpContext) {}

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const member = await Member.findOrFail(params.id) // We get our member by id
    const { firstName, lastName } = request.all() // We transfer the new data from the request to constants
    member.firstName = firstName // Assigning the data
    member.lastName = lastName // Assigning the data
    await member.save() // We save the member to the database
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const member = await Member.findOrFail(params.id) // Get the user by id
    await member.delete()
  }
}