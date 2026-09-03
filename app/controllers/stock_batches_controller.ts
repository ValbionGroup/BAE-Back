import type { HttpContext } from '@adonisjs/core/http'
import StockBatch from '#models/stock_batch'
import { loadFullInventory, remainingForBatch } from '#services/stock_service'
import { buildInventoryHtml } from '#services/print/print_inventory'
import { buildLabelsHtml, type LabelData } from '#services/print/print_labels'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'
import { stockBatchUpdateValidator, stockBatchValidator } from '#validators/stock'

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

  async labelsPdf({ request, response }: HttpContext) {
    const rawIds = request.qs().ids as string | undefined
    let batches: StockBatch[]
    if (rawIds) {
      const ids = rawIds
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id))
      batches = await StockBatch.query().whereIn('id', ids).preload('good')
    } else {
      batches = await StockBatch.query().preload('good').orderBy('id', 'desc').limit(12)
    }

    const labels: LabelData[] = []
    for (const batch of batches) {
      const remaining = await remainingForBatch(batch)
      if (remaining <= 0) continue
      labels.push({
        label: batch.label,
        goodName: batch.good?.name ?? '—',
        expirationDate: batch.expirationDate?.toFormat('dd/MM/yyyy') ?? null,
        qty: `${remaining} ${batch.good?.unit ?? ''}`.trim(),
      })
    }

    const buffer = await pdfService.generateFromHtml(buildLabelsHtml(labels), {
      footerTemplate: printFooterTemplate(
        'Instantané généré automatiquement — non mis à jour après impression.'
      ),
    })
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', 'inline; filename="etiquettes-lot.pdf"')
    return response.send(buffer)
  }

  /** `quantity` est un `decimal` : le driver `pg` le rend en string, donc le modèle
   *  le déclare ainsi et l'écriture doit convertir. */
  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(stockBatchValidator)
    const stockBatch = await StockBatch.create({
      expirationDate: payload.expirationDate ?? null,
      label: payload.label || (await nextLabel(payload.goodId)),
      quantity: String(payload.quantity),
      restockId: payload.restockId ?? null,
      goodId: payload.goodId,
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
    const { quantity, ...rest } = await request.validateUsing(stockBatchUpdateValidator)
    await stockBatch
      .merge({
        ...rest,
        ...(quantity === undefined ? {} : { quantity: String(quantity) }),
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
