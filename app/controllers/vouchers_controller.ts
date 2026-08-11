import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Voucher from '#models/voucher'
import ApiException from '#exceptions/api_exception'
import { voucherValidator, voucherUpdateValidator } from '#validators/voucher'

// Kept in sync with the "soon" threshold used for stock batches
// (`#services/stock_service`) so both panels mean the same thing by "urgent".
const WARN_WINDOW_DAYS = 7

interface VoucherPayload {
  id: number
  supplierId: number | null
  supplier: { id: number; name: string } | null
  value: number
  expiresAt: string | null
  condition: string | null
  usedAt: string | null
  used: boolean
  daysUntilExpiry: number | null
  expired: boolean
  warn: boolean
}

function parseDate(value: string, field: string): DateTime {
  const parsed = DateTime.fromISO(value)
  if (!parsed.isValid) {
    throw new ApiException('E_VALIDATION_ERROR', `\`${field}\` is not a valid ISO 8601 date`, 422)
  }
  return parsed
}

function toPayload(voucher: Voucher): VoucherPayload {
  const expiresAt = voucher.expiresAt
  const startOfToday = DateTime.now().startOf('day')
  const daysUntilExpiry = expiresAt
    ? Math.floor(expiresAt.startOf('day').diff(startOfToday, 'days').days)
    : null
  const used = voucher.usedAt !== null
  const expired = daysUntilExpiry !== null && daysUntilExpiry < 0

  return {
    id: voucher.id,
    supplierId: voucher.supplierId,
    supplier: voucher.supplier ? { id: voucher.supplier.id, name: voucher.supplier.name } : null,
    value: Number(voucher.value),
    expiresAt: expiresAt ? expiresAt.toISODate() : null,
    condition: voucher.condition,
    usedAt: voucher.usedAt ? voucher.usedAt.toISO() : null,
    used,
    daysUntilExpiry,
    expired,
    warn:
      !used && daysUntilExpiry !== null && daysUntilExpiry >= 0
        ? daysUntilExpiry <= WARN_WINDOW_DAYS
        : false,
  }
}

export default class VouchersController {
  async index({ serialize }: HttpContext) {
    const vouchers = await Voucher.query().preload('supplier').orderBy('expiresAt', 'asc')
    return serialize(vouchers.map(toPayload))
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(voucherValidator)
    const voucher = new Voucher()
    voucher.supplierId = payload.supplierId ?? null
    voucher.value = String(payload.value)
    voucher.expiresAt = parseDate(payload.expiresAt, 'expiresAt')
    voucher.condition = payload.condition ?? null
    voucher.usedAt = payload.usedAt ? parseDate(payload.usedAt, 'usedAt') : null
    await voucher.save()
    await voucher.load('supplier')
    return serialize(toPayload(voucher))
  }

  async update({ params, request, serialize }: HttpContext) {
    const voucher = await Voucher.query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(voucherUpdateValidator)

    if ('supplierId' in payload) voucher.supplierId = payload.supplierId ?? null
    if (payload.value !== undefined) voucher.value = String(payload.value)
    if (payload.expiresAt !== undefined) {
      voucher.expiresAt = parseDate(payload.expiresAt, 'expiresAt')
    }
    if ('condition' in payload) voucher.condition = payload.condition ?? null
    if ('usedAt' in payload) {
      voucher.usedAt = payload.usedAt ? parseDate(payload.usedAt, 'usedAt') : null
    }

    await voucher.save()
    await voucher.load('supplier')
    return serialize(toPayload(voucher))
  }

  async destroy({ params, response }: HttpContext) {
    const voucher = await Voucher.query().where('id', params.id).firstOrFail()
    await voucher.delete()
    return response.noContent()
  }
}
