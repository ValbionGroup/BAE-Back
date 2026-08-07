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
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    return serialize(permission)
  }
}
