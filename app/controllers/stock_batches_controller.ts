import type { HttpContext } from '@adonisjs/core/http'
import StockBatch from '#models/stock_batch'

/**
 * Numéro de lot lisible : `L25-4` est le 4ᵉ lot de ce produit.
 *
 * `stock_batches.label` est `NOT NULL` sans défaut, et c'est lui qui porte le
 * « prends le lot n°4 » attendu au sol. La numérotation est donc **par
 * produit** — un numéro global ne voudrait rien dire devant une étagère.
 *
 * Pas de garantie d'unicité : deux entrées simultanées sur le même produit
 * peuvent produire le même numéro. Aucune contrainte ne s'y oppose, et la
 * conséquence est un doublon d'affichage, pas une perte.
 */
async function nextLabel(goodId: number): Promise<string> {
  const [row] = await StockBatch.query().where('goodId', goodId).count('* as total')
  const total = Number((row as unknown as { $extras: { total: string } }).$extras.total)
  return `L${String(new Date().getFullYear()).slice(-2)}-${total + 1}`
}

export default class StockBatchesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const stockBatches = await StockBatch.query().preload('good').preload('restock')
    return serialize(stockBatches)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { expirationDate, label, quantity, restockId, goodId } = request.all()
    const stockBatch = await StockBatch.create({
      expirationDate,
      label: label || (await nextLabel(goodId)),
      quantity,
      restockId,
      goodId,
    })
    return serialize(stockBatch)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    return serialize(stockBatch)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    const { expirationDate, label, quantity, restockId, goodId } = request.all()
    await stockBatch
      .merge({
        expirationDate,
        label,
        quantity,
        restockId,
        goodId,
      })
      .save()
    return serialize(stockBatch)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    await stockBatch.delete()
  }
}
