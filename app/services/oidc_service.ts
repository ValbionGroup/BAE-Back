import * as client from 'openid-client'
import env from '#start/env'
import { backchannelUrl } from '#services/oidc_backchannel'

/**
 * Le SSO en mode BFF : c'est Adonis qui porte le flow OAuth, jamais le navigateur.
 * Le front n'obtient donc aucun jeton lisible.
 *
 * ⚠️ **Ne pas réintroduire `@adonisjs/ally` en croyant compléter ce fichier.**
 * Il a été retiré des dépendances le 2026-08-16, après avoir traîné inutilisé :
 * Ally v6 n'implémente pas PKCE — `Oauth2Driver` ne pose ni `code_challenge` à la
 * redirection, ni `code_verifier` à l'échange. Or EirbConnect l'exige
 * (`code_challenge_method: S256`) et le realm ne nous appartient pas : sa
 * politique n'est pas assouplissable. `openid-client` porte donc le flux, et
 * c'est aussi la bibliothèque de l'exemple d'implémentation d'EirbConnect — le
 * jour où quelque chose bloque, on parle le même langage qu'EirbWare.
 */

/** Les claims d'EirbConnect ne sont **pas** les claims standards. */
export type SsoClaims = {
  /** `sub` — UUID interne du realm. Clé technique, change si le realm est ré-importé. */
  subject: string
  /** `uid` — le login école. Identité métier, c'est elle qui réconcilie l'existant. */
  casId: string
  email: string
  firstName: string | null
  lastName: string | null
}

export type AuthorizationRequest = {
  url: string
  state: string
  codeVerifier: string
}

let cached: client.Configuration | null = null

/**
 * `fetch` des seules requêtes **serveur → IdP** : découverte, échange du code,
 * `/userinfo`. L'origine y est remplacée par `KEYCLOAK_INTERNAL_URL` quand elle
 * est fournie, de sorte que les métadonnées — et donc la redirection du
 * navigateur — gardent l'adresse publique.
 *
 * Sans variable, la fonction est l'identité : le comportement d'origine est
 * conservé partout où l'IdP est joignable à la même adresse des deux côtés.
 */
function backchannelFetch(): client.CustomFetch {
  const internal = env.get('KEYCLOAK_INTERNAL_URL')

  return (url, options) => fetch(backchannelUrl(url, internal), options)
}

/**
 * Découverte via `/.well-known/openid-configuration`, faite **une fois** et non à
 * chaque requête : c'est un aller-retour réseau vers l'IdP, et sa configuration
 * ne change pas entre deux connexions.
 */
export async function configuration(): Promise<client.Configuration> {
  if (cached !== null) return cached

  const issuer = new URL(env.get('KEYCLOAK_ISSUER'))

  // ⚠️ `allowInsecureRequests` doit passer par `execute` et **non** être appliqué
  // à la configuration après coup : la découverte est elle-même une requête HTTP,
  // donc elle échouerait la première, avant d'avoir pu être assouplie. C'est aussi
  // le seul emplacement qui couvre la requête de métadonnées.
  //
  // Développement uniquement — l'IdP local est en clair. Jamais en production, où
  // cela annulerait la protection du transport.
  const insecure = env.get('KEYCLOAK_ALLOW_INSECURE', false) === true
  const fetcher = backchannelFetch()

  const config = await client.discovery(
    issuer,
    env.get('KEYCLOAK_CLIENT_ID'),
    env.get('KEYCLOAK_CLIENT_SECRET'),
    undefined,
    {
      // La découverte est elle-même un appel serveur : elle doit passer par le
      // même chemin, sans quoi elle échouerait avant que la configuration existe.
      [client.customFetch]: fetcher,
      ...(insecure ? { execute: [client.allowInsecureRequests] } : {}),
    }
  )

  // À poser **aussi** sur la configuration : l'option de découverte ne couvre que
  // la requête de métadonnées, pas l'échange du code ni `/userinfo`.
  config[client.customFetch] = fetcher

  cached = config
  return config
}

/** Uniquement pour les tests : la configuration est mémorisée au premier appel. */
export function resetConfigurationCache(): void {
  cached = null
}

/**
 * ⚠️ `openid` doit figurer dans les scopes. Sans lui la réponse est de l'OAuth2
 * pur : pas de `sub`, et `/userinfo` refuse. `profile` est ce qui porte `uid`,
 * `prenom` et `nom`.
 */
const SCOPES = 'openid profile email'

export async function authorizationRequest(): Promise<AuthorizationRequest> {
  const config = await configuration()

  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: env.get('KEYCLOAK_CALLBACK_URL'),
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return { url: url.href, state, codeVerifier }
}

function claimString(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Échange le code contre les jetons, puis lit les claims.
 *
 * ⚠️ Les claims d'EirbConnect sont `uid`, `prenom`, `nom` — **pas**
 * `preferred_username`, `given_name`, `family_name`. Écrire les noms standards
 * par réflexe donne `undefined` partout, **sans erreur**.
 *
 * ⚠️ Un `uid` absent est traité comme un échec explicite, jamais comme un `null`
 * qu'on écrirait en base : sans lui la réconciliation avec un compte existant est
 * impossible, et l'utilisateur se retrouverait avec un second compte vierge.
 */
export async function exchange(
  currentUrl: URL,
  expected: { state: string; codeVerifier: string }
): Promise<SsoClaims> {
  const config = await configuration()

  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: expected.codeVerifier,
    expectedState: expected.state,
  })

  const idClaims = tokens.claims()
  if (idClaims === undefined) {
    throw new Error("La réponse de l'IdP ne porte pas d'id_token — le scope `openid` manque-t-il ?")
  }

  const subject = idClaims.sub
  const merged: Record<string, unknown> = { ...idClaims }

  // `uid`, `prenom` et `nom` peuvent n'être exposés que sur `/userinfo` selon les
  // mappers du realm : on complète plutôt que de supposer où ils vivent.
  if (claimString(merged, 'uid') === null) {
    const info = await client.fetchUserInfo(config, tokens.access_token, subject)
    Object.assign(merged, info)
  }

  const casId = claimString(merged, 'uid')
  if (casId === null) {
    throw new Error(
      "Le claim `uid` est absent : impossible de rattacher ce compte à l'annuaire de l'école."
    )
  }

  const email = claimString(merged, 'email')
  if (email === null) {
    throw new Error('Le claim `email` est absent.')
  }

  return {
    subject,
    casId,
    email,
    firstName: claimString(merged, 'prenom'),
    lastName: claimString(merged, 'nom'),
  }
}
