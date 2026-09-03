import * as client from 'openid-client'
import app from '@adonisjs/core/services/app'
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

/**
 * Ce que la DSI transmet : `email`, `firstName`, `lastName`, `ecole`, `diplome`
 * et `username`. Les quatre premiers alimentent le modèle utilisateur du realm,
 * qui les ré-expose donc sous les claims **standards** du scope `profile` ;
 * `ecole` et `diplome` n'ont pas d'équivalent standard et restent des claims
 * custom.
 */
export type SsoClaims = {
  /** `sub` — UUID interne du realm. Clé technique, change si le realm est ré-importé. */
  subject: string
  /**
   * `preferred_username` — le login école. Côté DSI l'attribut s'appelle
   * `username` ; le *username template importer* du realm en extrait la partie
   * qui est l'identifiant CAS, et c'est cette valeur-là qui arrive ici.
   * Identité métier : c'est elle qui réconcilie un compte existant.
   */
  casId: string
  email: string
  firstName: string | null
  lastName: string | null
  /** `ecole` — claim custom, sans équivalent OIDC standard. */
  school: string | null
  /** `diplome` — claim custom. Alimente `clients.promotion`, qui en dérive. */
  degree: string | null
}

/**
 * ⚠️ L'`id_token` est remonté **à côté** des claims et non fondu dedans : il
 * n'est pas une donnée d'identité mais un jeton opaque pour nous, dont le seul
 * usage est de servir d'`id_token_hint` à la déconnexion. `null` pour tout
 * compte qui n'est pas passé par l'IdP.
 */
export type SsoExchange = {
  claims: SsoClaims
  idToken: string | null
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
  // Hors production uniquement — l'IdP local et le stub des tests sont en clair.
  // Le garde est ici et non dans le `.env` : `.env.example` porte
  // `KEYCLOAK_ALLOW_INSECURE=true`, et un environnement amorcé par copie ne doit
  // pas pouvoir désactiver le transport chiffré vers l'IdP en production.
  //
  // ⚠️ `!inProduction` et non `inDev` : ce dernier exclut aussi `NODE_ENV=test`,
  // où le stub d'IdP est en HTTP — trois tests SSO tombaient.
  const insecure = !app.inProduction && env.get('KEYCLOAK_ALLOW_INSECURE', false) === true
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
 * pur : pas de `sub`, et `/userinfo` refuse. `profile` est ce qui porte
 * `preferred_username`, `given_name` et `family_name`. `ecole` et `diplome`
 * viennent de mappers custom, portés par le client lui-même.
 */
const SCOPES = 'openid profile email'

/**
 * ⚠️ Keycloak compare le `redirect_uri` de l'autorisation et celui de l'échange
 * caractère pour caractère : les deux doivent sortir d'ici, et d'ici seulement.
 */
function callbackUrl(): URL {
  return new URL(env.get('KEYCLOAK_CALLBACK_URL'))
}

export async function authorizationRequest(): Promise<AuthorizationRequest> {
  const config = await configuration()

  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl().href,
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
 * ⚠️ Ce commentaire a longtemps affirmé le contraire — que les claims étaient
 * `uid`, `prenom`, `nom`. C'était faux, et le symptôme d'un tel contresens est
 * silencieux : les claims mal nommés valent `undefined`, sans la moindre erreur.
 * Le script `scripts/setup-dev-keycloak.sh` fabrique le realm de dev conforme à
 * ce fichier — les deux se corrigent donc ensemble, sous peine de tests verts
 * contre un IdP imaginaire.
 *
 * ⚠️ Un `preferred_username` absent est traité comme un échec explicite, jamais comme un `null`
 * qu'on écrirait en base : sans lui la réconciliation avec un compte existant est
 * impossible, et l'utilisateur se retrouverait avec un second compte vierge.
 */
export async function exchange(
  currentUrl: URL,
  expected: { state: string; codeVerifier: string }
): Promise<SsoExchange> {
  const config = await configuration()

  // ⚠️ `authorizationCodeGrant` déduit le `redirect_uri` de l'URL qu'on lui
  // passe, et c'est la seule façon de le lui imposer. Celle reconstruite depuis
  // la requête entrante dépendrait de `X-Forwarded-Proto`, donc de `trustProxy` :
  // derrière un proxy TLS le schéma retombe à `http` et l'échange est rejeté.
  const responseUrl = callbackUrl()
  responseUrl.search = currentUrl.search

  const tokens = await client.authorizationCodeGrant(config, responseUrl, {
    pkceCodeVerifier: expected.codeVerifier,
    expectedState: expected.state,
  })

  const idClaims = tokens.claims()
  if (idClaims === undefined) {
    throw new Error("La réponse de l'IdP ne porte pas d'id_token — le scope `openid` manque-t-il ?")
  }

  const subject = idClaims.sub
  const merged: Record<string, unknown> = { ...idClaims }

  // Selon les mappers du realm, une partie de ces claims peut n'exister que sur
  // `/userinfo` : on complète plutôt que de supposer où ils vivent.
  if (claimString(merged, 'preferred_username') === null) {
    const info = await client.fetchUserInfo(config, tokens.access_token, subject)
    Object.assign(merged, info)
  }

  const casId = claimString(merged, 'preferred_username')
  if (casId === null) {
    throw new Error(
      "Le claim `preferred_username` est absent : impossible de rattacher ce compte à l'annuaire de l'école."
    )
  }

  const email = claimString(merged, 'email')
  if (email === null) {
    throw new Error('Le claim `email` est absent.')
  }

  return {
    claims: {
      subject,
      casId,
      email,
      firstName: claimString(merged, 'given_name'),
      lastName: claimString(merged, 'family_name'),
      school: claimString(merged, 'ecole'),
      degree: claimString(merged, 'diplome'),
    },
    idToken: tokens.id_token ?? null,
  }
}

/**
 * L'URL de déconnexion RP-initiated, construite depuis les métadonnées
 * découvertes — `end_session_endpoint` en fait partie, il n'y a donc rien à
 * configurer en plus.
 *
 * ⚠️ Passer par `buildEndSessionUrl` et non concaténer soi-même : la
 * bibliothèque y ajoute le `client_id`, que Keycloak exige pour valider la
 * redirection de retour contre les `post.logout.redirect.uris` du client.
 *
 * ⚠️ `postLogoutRedirectUri` ne doit **jamais** venir du client : Keycloak la
 * valide, mais une liste blanche large en ferait une redirection ouverte. Elle
 * se résout côté serveur, comme l'URI de callback.
 */
export async function endSessionUrl(params: {
  idToken: string
  postLogoutRedirectUri: string
}): Promise<string> {
  const config = await configuration()

  return client.buildEndSessionUrl(config, {
    id_token_hint: params.idToken,
    post_logout_redirect_uri: params.postLogoutRedirectUri,
  }).href
}
