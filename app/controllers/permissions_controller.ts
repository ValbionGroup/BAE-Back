import type { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'

export default class PermissionsController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const permissions = await Permission.all()
    return permissions
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { permission } = request.all()
    const newPermission = await Permission.create({ permission })
    return newPermission
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    return permission
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    const { permission: newPermission } = request.all()
    permission.permission = newPermission
    await permission.save()
    return permission
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    await permission.delete()
    return { message: 'Permission deleted successfully' }
  }
}
