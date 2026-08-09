import type { HttpContext } from '@adonisjs/core/http'
import Supplier from '#models/supplier'

export default class SuppliersController {
  /**
   * Display a list of resource, alphabetically.
   *
   * Deliberately without `preload('goods')` / `preload('restocks')`: the only
   * consumer is the supplier picker of the voucher modal, which needs `id` and
   * `name`. Preloading returned the whole catalogue and every restock ever
   * recorded — invisible today, costly once restocks pile up.
   *
   * The alphabetical order is not cosmetic either: this feeds a `<select>` a
   * human scans by eye, and insertion order means nothing to them.
   */
  async index({ serialize }: HttpContext) {
    return serialize(await Supplier.query().orderBy('name'))
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { name } = request.all()
    const supplier = new Supplier()
    supplier.name = name
    await supplier.save()
    return serialize(supplier)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(
      await Supplier.query()
        .preload('goods')
        .preload('restocks')
        .where('id', params.id)
        .firstOrFail()
    )
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const supplier = await Supplier.query()
      .preload('goods')
      .preload('restocks')
      .where('id', params.id)
      .firstOrFail() // We get our supplier by id
    const { name } = request.all() // We transfer the new data from the request to constants
    supplier.name = name // Assigning the data
    await supplier.save() // We save the supplier to the database
    return serialize(supplier)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const supplier = await Supplier.query()
      .preload('goods')
      .preload('restocks')
      .where('id', params.id)
      .firstOrFail() // Get the supplier by id
    await supplier.delete()
  }
}
