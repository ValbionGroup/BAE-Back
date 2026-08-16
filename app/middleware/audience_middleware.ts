import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'
import Client from '#models/client'

export type Audience = 'member' | 'client'

/**
 * **C'est ici que vit la séparation dashboard / zone publique**, et non au login.
 *
 * Les trois origines de production partagent `bae.eirb.fr` — condition qui rend
 * l'authentification par cookie possible (§9.8), mais qui implique aussi qu'un
 * cookie posé pour `order.bae.eirb.fr` est **envoyé à `api.bae.eirb.fr`** par le
 * dashboard. Un client authentifié atteindrait donc les routes du dashboard si
 * seule la porte d'entrée les distinguait.
 *
 * Refuser au moment de la connexion est un bon message d'erreur ; ce middleware
 * est la sécurité. Les deux sont nécessaires, et ils ne font pas le même travail.
 *
 * ⚠️ `middleware.auth()` ne prouve que l'identité, jamais l'appartenance.
 */
export default class AudienceMiddleware {
  async handle(ctx: HttpContext, next: NextFn, audience: Audience) {
    const user = ctx.auth.getUserOrFail()

    const belongs =
      audience === 'member'
        ? (await Member.find(user.id)) !== null
        : (await Client.find(user.id)) !== null

    if (!belongs) {
      // Volontairement muet sur ce qui manque : un message précis dirait à un
      // client authentifié que le dashboard existe et ce qu'il faut pour y entrer.
      throw new ApiException('E_FORBIDDEN', 'Accès non autorisé pour ce compte.', 403)
    }

    return next()
  }
}
