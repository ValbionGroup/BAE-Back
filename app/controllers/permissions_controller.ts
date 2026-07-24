import type { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'

export default class PermissionsController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const permissions = await Permission.all()
    return serialize(permissions)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { permission } = request.all()
    const newPermission = await Permission.create({ permission })
    return serialize(newPermission)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    return serialize(permission)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    const { permission: newPermission } = request.all()
    permission.permission = newPermission
    await permission.save()
    return serialize(permission)
  }

  /**
   * Delete record
   */
  async destroy({ params, serialize }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    await permission.delete()
    return serialize({ message: 'Permission deleted successfully' })
  }
}
