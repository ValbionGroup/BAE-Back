import type { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'

export default class PermissionsController {
  async index({ serialize }: HttpContext) {
    const permissions = await Permission.all()
    return serialize(permissions)
  }

  async show({ params, serialize }: HttpContext) {
    const permission = await Permission.findOrFail(params.id)
    return serialize(permission)
  }
}
