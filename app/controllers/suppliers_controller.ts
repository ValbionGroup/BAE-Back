import type { HttpContext } from '@adonisjs/core/http'
import Supplier from '#models/supplier'

export default class SuppliersController {
  async index({ serialize }: HttpContext) {
    // Deliberately without `preload('goods')` / `preload('restocks')`: the only
    // consumer is the supplier picker, which needs the id and the name. Preloading
    // would return the whole catalogue and every restock ever recorded. The
    // alphabetical order is not cosmetic either: the list is scanned by eye in a
    // `<select>`.
    return serialize(await Supplier.query().orderBy('name'))
  }

  async store({ request, serialize }: HttpContext) {
    const { name } = request.all()
    const supplier = new Supplier()
    supplier.name = name
    await supplier.save()
    return serialize(supplier)
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(
      await Supplier.query()
        .preload('goods')
        .preload('restocks')
        .where('id', params.id)
        .firstOrFail()
    )
  }

  async update({ params, request, serialize }: HttpContext) {
    const supplier = await Supplier.query()
      .preload('goods')
      .preload('restocks')
      .where('id', params.id)
      .firstOrFail()
    const { name } = request.all()
    supplier.name = name
    await supplier.save()
    return serialize(supplier)
  }

  async destroy({ params }: HttpContext) {
    const supplier = await Supplier.query()
      .preload('goods')
      .preload('restocks')
      .where('id', params.id)
      .firstOrFail()
    await supplier.delete()
  }
}
