import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Client from '#models/client'
import Member from '#models/member'
import type { SsoClaims } from '#services/oidc_service'
import { formatCursus } from '#services/cursus'

/** Les deux zones, et leurs politiques opposées. Liste fermée, validée à l'entrée. */
export const SSO_APPS = ['dashboard', 'public'] as const
export type SsoApp = (typeof SSO_APPS)[number]

export function isSsoApp(value: unknown): value is SsoApp {
  return typeof value === 'string' && (SSO_APPS as readonly string[]).includes(value)
}

export type ResolutionOutcome =
  { status: 'ok'; user: User } | { status: 'not-a-member'; user: User }

/**
 * Résolution en **trois temps**, et surtout pas un `firstOrCreate`.
 *
 * ⚠️ Sauter l'étape 2, c'est donner un second compte vierge — sans ligne
 * `members`, donc sans rôle, sans points, sans historique — à **chaque membre
 * existant** le jour de la bascule. L'erreur est silencieuse : l'utilisateur voit
 * un dashboard vide et croit à une perte de données.
 *
 * ⚠️ L'email n'est **jamais** une clé de recherche : il change. On le met à jour
 * au passage si le claim diffère, rien de plus.
 */
async function resolveUser(claims: SsoClaims): Promise<User> {
  // 1. Déjà lié à l'IdP : retour d'un utilisateur connu.
  let user = await User.findBy('keycloakSub', claims.subject)

  if (user === null) {
    // 2. Compte existant se connectant au SSO pour la première fois : on le
    //    **lie**, on ne crée rien. `cas_id` est l'identité métier, seule clé de
    //    réconciliation fiable — elle survit à un ré-import du realm.
    user = await User.findBy('casId', claims.casId)
    if (user !== null) {
      user.keycloakSub = claims.subject
    }
  }

  // 3. Personne : c'est une vraie création.
  if (user === null) {
    user = new User()
    user.casId = claims.casId
    user.keycloakSub = claims.subject
    user.email = claims.email
    // Pas de mot de passe : un compte né du SSO n'en a pas et ne s'en invente pas.
    user.password = null
  }

  if (user.email !== claims.email) user.email = claims.email
  if (claims.firstName !== null) user.firstName = claims.firstName
  if (claims.lastName !== null) user.lastName = claims.lastName

  await user.save()
  return user
}

/**
 * Le provisionnement dépend de la zone, et les deux politiques sont opposées.
 *
 * ⚠️ Refuser ici n'est **pas** la sécurité, c'est un bon message d'erreur : les
 * trois origines partagent `bae.eirb.fr`, donc le cookie posé côté public est
 * aussi envoyé à l'API par le dashboard. La sécurité réelle, ce sont les gardes de
 * route (`member` requis / `client` requis), qui s'appliquent quel que soit le
 * lieu de connexion.
 */
export async function provision(app: SsoApp, claims: SsoClaims): Promise<ResolutionOutcome> {
  return db.transaction(async () => {
    const user = await resolveUser(claims)

    if (app === 'dashboard') {
      // Aucun provisionnement : on n'ouvre pas le dashboard à quiconque possède
      // un compte SSO de l'école. Il faut avoir été inscrit comme membre.
      const member = await Member.find(user.id)
      return member === null
        ? ({ status: 'not-a-member', user } as const)
        : ({ status: 'ok', user } as const)
    }

    // Zone publique : JIT provisioning. C'est **l'unique chemin de création d'un
    // compte client** — le dashboard n'en a aucun, et `POST /clients` n'existe pas.
    // `promotion` et `school` sont **dérivés de l'IdP**, pas saisis : `diplome` et
    // `ecole` sont désormais transmis, donc le bureau ne les édite plus (ils ont
    // été retirés du validateur `client`). `diplome` est traduit en libellé lisible
    // par `formatCursus` — le code brut de l'IdP ne dit rien au bureau.
    // Ils suivent la même règle que le nom —
    // écrasés quand le claim est là, préservés quand il manque, car un claim
    // absent est une information manquante et non un ordre d'effacement.
    const existing = await Client.find(user.id)
    if (existing === null) {
      await Client.create({
        id: user.id,
        phone: null,
        promotion: formatCursus(claims.degree),
        school: claims.school,
        registeredAt: DateTime.now(),
        note: null,
        noteAuthorId: null,
      })
    } else {
      if (claims.degree !== null) existing.promotion = formatCursus(claims.degree)
      if (claims.school !== null) existing.school = claims.school
      await existing.save()
    }

    return { status: 'ok', user } as const
  })
}
