import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import User from '#models/user'
import Member from '#models/member'
import PasswordResetToken from '#models/password_reset_token'
import BadRequestException from '#exceptions/bad_request_exception'
import { PasswordResetNotification } from '#mails/password_reset_notification'
import { frontendUrl } from '#services/frontend_url'
import { digest, randomToken } from '#services/token_digest'

/**
 * ⚠️ Cette durée est **annoncée à l'utilisateur** avant qu'il ne demande son lien :
 * la page « Mot de passe oublié » du dashboard écrit « valable 30 minutes ».
 * Rien ne relie les deux dépôts à la compilation — si vous changez ce nombre,
 * changez aussi `RESET_LINK_TTL_LABEL` dans
 * `BAE-Front/projects/bae-dashboard/src/app/pages/guest/mot-de-passe-oublie/`.
 */
export const RESET_TOKEN_TTL_MINUTES = 30

/**
 * Le lien vise **toujours** le dashboard : seuls les membres peuvent réinitialiser
 * un mot de passe, et la zone publique se connecte exclusivement par EirbConnect.
 * Passer par `frontendUrl` rend l'ajout d'une zone possible en une ligne, sans
 * jamais accepter de destination venue du client.
 */
function resetUrl(token: string): string {
  const base = frontendUrl('dashboard').replace(/\/$/, '')
  return `${base}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`
}

/**
 * Demander un lien de réinitialisation.
 *
 * ⚠️ Cette fonction ne rend **rien** et ne lève **jamais**, quelle que soit la
 * branche : compte inconnu, compte SSO, compte non-membre. L'appelant répond 204
 * dans tous les cas. Un `404` ou un message « compte introuvable » serait un
 * oracle d'énumération, et `User.verifyPasswordCredentials` a justement été écrit
 * pour n'en laisser aucun sur le chemin voisin.
 *
 * ⚠️ La recherche est faite **inconditionnellement**, et l'envoi passe par
 * `sendLater()`. Ce n'est pas une optimisation : c'est ce qui garde le temps de
 * réponse plat entre « ce compte existe » et « il n'existe pas ». Sous
 * `MAIL_MAILER=log` la différence est invisible ; avec un vrai SMTP, un `send()`
 * synchrone ferait de cet endpoint un oracle temporel du jour au lendemain.
 */
export async function requestReset(email: string): Promise<void> {
  const user = await User.findBy('email', email)
  const member = user === null ? null : await Member.find(user.id)

  /**
   * Deux conditions, et la seconde compte autant que la première : donner un mot
   * de passe à un compte né du SSO créerait un second chemin d'authentification
   * que personne n'a demandé, et contredirait ce que `hasPassword` raconte au
   * dashboard. Ces comptes passent par EirbConnect.
   */
  const eligible = user !== null && member !== null && user.password !== null
  if (!eligible) return

  const token = randomToken()

  // Un seul lien vivant par compte : une nouvelle demande périme les précédentes,
  // sinon chaque clic sur « Envoyer le lien » laisserait un lien de plus en
  // circulation, tous valables trente minutes.
  await PasswordResetToken.query()
    .where('userId', user.id)
    .whereNull('usedAt')
    .update({ usedAt: DateTime.now() })

  await PasswordResetToken.create({
    userId: user.id,
    tokenDigest: digest(token),
    expiresAt: DateTime.now().plus({ minutes: RESET_TOKEN_TTL_MINUTES }),
  })

  await mail.sendLater(
    new PasswordResetNotification(user.email, resetUrl(token), RESET_TOKEN_TTL_MINUTES)
  )
}

/**
 * Consommer un lien et poser le nouveau mot de passe.
 */
export async function consumeReset(token: string, password: string): Promise<void> {
  const row = await PasswordResetToken.query()
    .where('tokenDigest', digest(token))
    .whereNull('usedAt')
    .where('expiresAt', '>', DateTime.now().toSQL())
    .first()

  // Un seul code pour « inconnu », « déjà utilisé » et « expiré » : distinguer les
  // trois dirait à qui tâtonne lequel de ses jetons a existé.
  if (row === null) {
    throw new BadRequestException(
      'E_INVALID_RESET_TOKEN',
      'Ce lien de réinitialisation est invalide ou a expiré.'
    )
  }

  const user = await User.findOrFail(row.userId)

  /**
   * L'atomicité porte sur la paire « jeton consommé ⟺ mot de passe posé ». Dans
   * l'autre ordre, un échec entre les deux laisserait un lien encore rejouable
   * sur un mot de passe déjà changé. L'inverse — jeton brûlé sans changement —
   * est seulement pénible : il suffit d'en redemander un.
   */
  await db.transaction(async (trx) => {
    user.useTransaction(trx)
    // En clair : le `beforeSave` du mixin hache. Une valeur déjà hachée le serait
    // deux fois, et le mot de passe ne connecterait plus.
    user.password = password
    await user.save()

    await PasswordResetToken.query({ client: trx })
      .where('userId', user.id)
      .whereNull('usedAt')
      .update({ usedAt: DateTime.now() })
  })

  /**
   * Toutes les sessions tombent, y compris celles du navigateur courant : une
   * réinitialisation est le remède à une compromission, et laisser vivre la
   * session du voleur annulerait le geste entier.
   *
   * ⚠️ La 2FA n'est **pas** touchée — ni désactivée, ni régénérée, ni consommée.
   * C'est la ligne la plus facile à « nettoyer » par erreur, et la plus coûteuse :
   * une réinitialisation qui efface le second facteur transforme la compromission
   * d'une boîte mail en prise de contrôle complète du compte, soit exactement ce
   * que ce second facteur existe pour empêcher.
   *
   * Même raison pour ne pas connecter automatiquement : la session émise ici
   * aurait contourné la 2FA avec la seule boîte mail.
   */
  const tokens = await User.accessTokens.all(user)
  for (const accessToken of tokens) {
    await User.accessTokens.delete(user, accessToken.identifier)
  }
}
