import type { HttpContext } from '@adonisjs/core/http'
import { receivablesForEvent } from '#services/receivable_service'
import { buildReceivablesHtml } from '#services/print/print_receivables'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'
import {
  categoriesOf,
  categoryOf,
  create,
  remove,
  update as updateCategory,
  qrTokenFor,
  rotateNonce,
  setPrices,
} from '#services/sponsorship_service'
import {
  sponsorshipCategoryValidator,
  sponsorshipCategoryPatchValidator,
  sponsorshipPricesValidator,
} from '#validators/sponsorship'

export default class SponsorshipCategoriesController {
  async index({ params, serialize }: HttpContext) {
    return serialize(await categoriesOf(Number(params.id)))
  }

  async store({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(sponsorshipCategoryValidator)
    return serialize(await create(Number(params.id), payload.label, payload.mode))
  }

  async update({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(sponsorshipCategoryPatchValidator)
    return serialize(await updateCategory(Number(params.id), Number(params.categoryId), payload))
  }

  async prices({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(sponsorshipPricesValidator)
    return serialize(await setPrices(Number(params.id), Number(params.categoryId), payload.prices))
  }

  async qr({ params, serialize }: HttpContext) {
    const token = await qrTokenFor(Number(params.id), Number(params.categoryId))
    // Ni `expiresAt` ni `ttlSeconds` : ce jeton ne se renouvelle pas, contrairement
    // aux QR d'identité et de précommande.
    return serialize({ token })
  }

  async rotate({ params, serialize }: HttpContext) {
    await rotateNonce(Number(params.id), Number(params.categoryId))
    return serialize(await categoryOf(Number(params.id), Number(params.categoryId)))
  }

  async receivables({ params, serialize }: HttpContext) {
    return serialize(await receivablesForEvent(Number(params.id)))
  }

  async receivablesPdf({ params, response }: HttpContext) {
    const statement = await receivablesForEvent(Number(params.id))
    const buffer = await pdfService.generateFromHtml(buildReceivablesHtml(statement), {
      footerTemplate: printFooterTemplate(
        'Instantané généré automatiquement — non mis à jour après impression.'
      ),
    })
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="justificatif-${params.id}.pdf"`)
    return response.send(buffer)
  }

  async destroy({ params, response }: HttpContext) {
    await remove(Number(params.id), Number(params.categoryId))
    return response.noContent()
  }
}
