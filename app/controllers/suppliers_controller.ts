import type { HttpContext } from '@adonisjs/core/http'
import Supplier from '#models/supplier'
import db from '@adonisjs/lucid/services/db'
import { supplierUpdateValidator, supplierValidator } from '#validators/catalog'

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
    const { name } = await request.validateUsing(supplierValidator)
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
    // `merge` et non une affectation : le validateur rend `name` optionnel, et
    // une clé absente doit laisser la colonne intacte.
    supplier.merge(await request.validateUsing(supplierUpdateValidator))
    await supplier.save()
    return serialize(supplier)
  }

  /**
   * ⚠️ `good_suppliers` et `vouchers` sont en **CASCADE** sur `suppliers` : sans
   * ce refus, supprimer une enseigne détruisait silencieusement tous ses prix
   * **et tous ses bons d'achat**. Un bon d'achat est un objet au porteur ; c'est
   * la seule exigence de sécurité explicite du cahier des charges.
   *
   * `restocks.supplier_id` est en `SET NULL` et ne bloque donc pas : un réassort
   * passé garde sa trace, il perd seulement le nom de son enseigne.
   *
   * Les préchargements `goods` / `restocks` qui vivaient ici ne servaient à
   * rien — la ligne était lue puis supprimée. Ce sont des comptes qu'il faut.
   */
  async destroy({ params, response }: HttpContext) {
    const supplier = await Supplier.query().where('id', params.id).firstOrFail()

    const [vouchers, prices] = await Promise.all([
      db.from('vouchers').where('supplier_id', supplier.id).count('* as total').first(),
      db.from('good_suppliers').where('supplier_id', supplier.id).count('* as total').first(),
    ])

    const voucherCount = Number(vouchers?.total ?? 0)
    const priceCount = Number(prices?.total ?? 0)

    if (voucherCount > 0 || priceCount > 0) {
      const causes = [
        voucherCount > 0 ? `${voucherCount} bon(s) d'achat` : null,
        priceCount > 0 ? `${priceCount} prix` : null,
      ].filter((cause): cause is string => cause !== null)

      return response.conflict({
        error: {
          code: 'E_SUPPLIER_IN_USE',
          message: `${causes.join(' et ')} rattaché(s) à « ${supplier.name} » : retirez-les d’abord.`,
        },
      })
    }

    await supplier.delete()
    return response.noContent()
  }
}
