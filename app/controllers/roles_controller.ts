import type { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'

export default class RolesController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const roles = await Role.query()
    return roles
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { name } = request.all()
    const role = await Role.create({ name })
    return role
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    return role
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const { name } = request.body()
    const role = await Role.find(params.id)
    if (!role) {
      throw new Error('Role not found')
    }
    role.name = name
    await role.save()
    return role
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const role = await Role.find(params.id)
    if (!role) {
      throw new Error('Role not found')
    }
    await role.delete()
  }
}
