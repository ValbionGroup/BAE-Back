import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import ApiException from '#exceptions/api_exception'

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
      // `ApiException` et non `new Error` : le gestionnaire ne traite spécialement
      // que la première. Une `Error` nue n'a même pas de statut et sort en 500
      // franc, là où le client attend un 404 — et le front ne peut alors rien
      // formuler d'utile.
      throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
    }
    return serialize(member)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      // `ApiException` et non `new Error` : le gestionnaire ne traite spécialement
      // que la première. Une `Error` nue n'a même pas de statut et sort en 500
      // franc, là où le client attend un 404 — et le front ne peut alors rien
      // formuler d'utile.
      throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
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
      // `ApiException` et non `new Error` : le gestionnaire ne traite spécialement
      // que la première. Une `Error` nue n'a même pas de statut et sort en 500
      // franc, là où le client attend un 404 — et le front ne peut alors rien
      // formuler d'utile.
      throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
    }
    await member.delete()
  }
}
