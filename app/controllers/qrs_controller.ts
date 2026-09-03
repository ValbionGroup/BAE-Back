import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { errors as joseErrors } from 'jose'
import ApiException from '#exceptions/api_exception'
import JwtService from '#services/jwt_service'
import { describeBuyer, searchBuyers, validFastPass } from '#services/buyer_service'
import { pickupFor } from '#services/pre_order_service'
import { categoryForQr, isExhausted } from '#services/sponsorship_service'
import { qrVerifyValidator, buyerSearchValidator } from '#validators/qr'

/**
 * Choisi contre les 60 s par défaut : dans une salle bondée, le rafraîchissement
 * du QR côté téléphone est le mode de panne le plus probable. Trois minutes
 * gardent l'essentiel de la protection — le temps d'envoyer une capture, elle
 * est morte.
 */
const QR_TTL_SECONDS = 180

export default class QrsController {
  /** Le QR de la personne connectée — chacun n'émet que le sien. */
  async mine({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const jwt = new JwtService()

    const token = await jwt.generateQrToken({ type: 'identity', userId: user.id }, QR_TTL_SECONDS)

    return serialize({
      token,
      expiresAt: DateTime.now().plus({ seconds: QR_TTL_SECONDS }).toISO(),
      ttlSeconds: QR_TTL_SECONDS,
    })
  }

  /**
   * Lecture d'un QR au comptoir.
   *
   * ⚠️ Un QR refusé est un **422**, jamais un 401 : le jeton scanné est une
   * donnée soumise, pas les identifiants de l'appelant. Le front lit tout 401
   * hors `/auth/` comme une session morte — un QR périmé déconnectait le
   * comptoir en plein service.
   */
  async verify({ request, serialize }: HttpContext) {
    const { token } = await request.validateUsing(qrVerifyValidator)
    const jwt = new JwtService()

    let payload
    try {
      payload = await jwt.verifyQrToken(token)
    } catch (error) {
      // Deux refus distincts : « rafraîchis ton écran » et « ce QR n'est pas des
      // nôtres » n'appellent pas le même geste au comptoir.
      if (error instanceof joseErrors.JWTExpired) {
        throw new ApiException('E_QR_EXPIRED', 'Ce QR a expiré — demandez-en un nouveau.', 422)
      }
      throw new ApiException('E_QR_INVALID', "Ce QR n'est pas valide.", 422)
    }

    // Le type vit **dans** le jeton précisément pour que le comptoir n'ait qu'un
    // seul scanner : les trois QR de l'association passent par ici.
    if (payload.type === 'pre_order') {
      return serialize({
        kind: 'pre_order' as const,
        buyer: await describeBuyer(payload.userId),
        preOrder: await pickupFor(payload.preOrderId, payload.userId),
      })
    }

    if (payload.type === 'sponsorship_category') {
      const category = await categoryForQr(payload.categoryId, payload.nonce)
      if (!category) {
        throw new ApiException(
          'E_CATEGORY_REVOKED',
          "Ce QR de catégorie n'est plus valide — réimprimez-le.",
          422
        )
      }
      if (isExhausted(category)) {
        throw new ApiException(
          'E_CATEGORY_EXHAUSTED',
          `Ce QR a atteint ses ${category.maxOrders} commandes — vente au prix public.`,
          422
        )
      }
      return serialize({ kind: 'sponsorship_category' as const, category })
    }

    if (payload.type === 'fast_pass') {
      // Un fast pass identifie son porteur aussi bien qu'un QR d'identité ; ce
      // qui décide, c'est l'échéance, pas le type du jeton.
      const pass = await validFastPass(payload.userId, payload.fastPassId)
      if (!pass) {
        throw new ApiException('E_FAST_PASS_EXPIRED', "Ce fast pass n'est plus valide.", 422)
      }
      return serialize({ kind: 'buyer' as const, buyer: await describeBuyer(payload.userId) })
    }

    return serialize({ kind: 'buyer' as const, buyer: await describeBuyer(payload.userId) })
  }

  /** Chemin dégradé : retrouver un acheteur par son nom. */
  async search({ request, serialize }: HttpContext) {
    const { q } = await request.validateUsing(buyerSearchValidator)
    return serialize(await searchBuyers(q))
  }
}
