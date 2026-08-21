import type { HttpContext } from '@adonisjs/core/http'
import { consumeReset, requestReset } from '#services/password_reset_service'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/password_reset'

/**
 * Les deux routes sont anonymes, donc automatiquement exemptées de CSRF : le
 * prédicat `exceptRoutes` de `config/shield.ts` exempte toute requête dépourvue
 * du cookie de session.
 *
 * ⚠️ Asymétrie à ne pas « corriger » : `reset` est protégée quand elle *est*
 * appelée avec une session vivante — quelqu'un qui clique le lien depuis sa boîte
 * mail alors qu'il est encore connecté ailleurs. Le `csrfInterceptor` du front
 * couvre déjà tous les POST, donc il n'y a pas de trou.
 */
export default class PasswordResetController {
  /**
   * ⚠️ **Toujours 204**, corps vide, quelle que soit la branche. Voir
   * `requestReset` : c'est la garantie anti-énumération de tout le flux, et elle
   * se perd au premier `if` qui répondrait autre chose.
   */
  async request({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    await requestReset(email)

    return response.noContent()
  }

  async reset({ request, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    await consumeReset(token, password)

    // Pas de session ouverte ici, délibérément : elle aurait contourné la 2FA avec
    // la seule boîte mail. Le front renvoie vers la page de connexion.
    return response.noContent()
  }
}
