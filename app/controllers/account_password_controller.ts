import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import BadRequestException from '#exceptions/bad_request_exception'
import { changePasswordValidator } from '#validators/account'

export default class AccountPasswordController {
  /**
   * Changer son mot de passe en connaissant l'ancien.
   *
   * La vérification passe par `User.verifyPasswordCredentials` et non par
   * `verifyCredentials` : le garde du modèle est ce qui distingue « mauvais mot de
   * passe » (401) de « ce compte n'en a pas » (un 500 sans lui).
   */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, password } = await request.validateUsing(changePasswordValidator)

    // Un compte né du SSO n'a pas de mot de passe à remplacer, et lui en donner un
    // ici ouvrirait un second chemin d'authentification que personne n'a demandé.
    // Le dashboard masque déjà le panneau pour ces comptes ; ceci est la sécurité.
    if (user.password === null) {
      throw new BadRequestException(
        'E_NO_PASSWORD_SET',
        "Ce compte se connecte via EirbConnect et n'a pas de mot de passe."
      )
    }

    await User.verifyPasswordCredentials(user.email, currentPassword)

    // Affectation en clair : le `beforeSave` du mixin `withAuthFinder` hache la
    // colonne quand elle est sale. Assigner une valeur déjà hachée la hacherait
    // une seconde fois, et le mot de passe ne servirait plus à se connecter.
    user.password = password
    await user.save()

    /**
     * Toutes les autres sessions tombent, la courante survit. Les deux moitiés
     * comptent : laisser vivre la session d'un voleur annule le geste même de
     * changer son mot de passe, et déconnecter la session courante jetterait
     * l'utilisateur hors de la page où il vient de réussir son changement.
     */
    const currentIdentifier = user.currentAccessToken?.identifier
    const tokens = await User.accessTokens.all(user)
    for (const token of tokens) {
      if (String(token.identifier) === String(currentIdentifier)) continue
      await User.accessTokens.delete(user, token.identifier)
    }

    return response.noContent()
  }
}
