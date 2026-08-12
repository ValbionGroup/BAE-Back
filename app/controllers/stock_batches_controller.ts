import type { HttpContext } from '@adonisjs/core/http'
import StockBatch from '#models/stock_batch'
import { loadFullInventory } from '#services/stock_service'
import { buildInventoryHtml } from '#services/print/print_inventory'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'

// Numbering is PER good: `L25-4` is the 4th batch of that product, which is what
// one reads in front of a shelf — a global number would mean nothing there. No
// uniqueness guarantee: two simultaneous entries on the same good can draw the
// same number, which costs a display duplicate, not a loss.
async function nextLabel(goodId: number): Promise<string> {
  const [row] = await StockBatch.query().where('goodId', goodId).count('* as total')
  const total = Number((row as unknown as { $extras: { total: string } }).$extras.total)
  return `L${String(new Date().getFullYear()).slice(-2)}-${total + 1}`
}

export default class StockBatchesController {
  async index({ serialize }: HttpContext) {
    const stockBatches = await StockBatch.query().preload('good').preload('restock')
    return serialize(stockBatches)
  }

  async inventoryPdf({ response }: HttpContext) {
    const rows = await loadFullInventory()
    const buffer = await pdfService.generateFromHtml(buildInventoryHtml(rows), {
      landscape: true,
      footerTemplate: printFooterTemplate(
        'Instantané généré automatiquement — non mis à jour après impression.'
      ),
    })
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', 'inline; filename="inventaire-stock.pdf"')
    return response.send(buffer)
  }

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

  async show({ params, serialize }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    return serialize(stockBatch)
  }

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

  async destroy({ params }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    await stockBatch.delete()
  }
}
