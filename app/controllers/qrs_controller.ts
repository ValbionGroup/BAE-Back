import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { errors as joseErrors } from 'jose'
import ApiException from '#exceptions/api_exception'
import JwtService from '#services/jwt_service'
import { describeBuyer, searchBuyers } from '#services/buyer_service'
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

  /** Lecture d'un QR au comptoir. */
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
        throw new ApiException('E_QR_EXPIRED', 'Ce QR a expiré — demandez-en un nouveau.', 401)
      }
      throw new ApiException('E_QR_INVALID', "Ce QR n'est pas valide.", 401)
    }

    if (payload.type !== 'identity') {
      throw new ApiException(
        'E_QR_WRONG_TYPE',
        "Ce QR n'identifie pas une personne : il ne peut pas être utilisé ici.",
        422
      )
    }

    return serialize(await describeBuyer(payload.userId))
  }

  /** Chemin dégradé : retrouver un acheteur par son nom. */
  async search({ request, serialize }: HttpContext) {
    const { q } = await request.validateUsing(buyerSearchValidator)
    return serialize(await searchBuyers(q))
  }
}
