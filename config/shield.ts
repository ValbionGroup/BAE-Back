import { defineConfig } from '@adonisjs/shield'
import { SESSION_COOKIE, cookieScope } from '#services/session_cookie'

const shieldConfig = defineConfig({
  /**
   * Configure CSP policies for your app. Refer documentation
   * to learn more.
   */
  csp: {
    /**
     * Enable the Content-Security-Policy header.
     */
    enabled: false,

    /**
     * Per-resource CSP directives.
     */
    directives: {},

    /**
     * Report violations without blocking resources.
     */
    reportOnly: false,
  },

  /**
   * Configure CSRF protection options. Refer documentation
   * to learn more.
   */
  csrf: {
    /**
     * Activé depuis la bascule sur le cookie `httpOnly`.
     *
     * ⚠️ **L'ordre a compté** : tant que le front portait un `Bearer`, le CSRF
     * était inutile (un site tiers ne peut pas fabriquer cet en-tête) *et*
     * l'activer aurait tout cassé. Avec un cookie, le navigateur authentifie
     * désormais **toute** requête vers l'API, y compris celles déclenchées par un
     * autre site : c'est exactement ce que le CSRF empêche.
     *
     * Le front recopie le cookie `XSRF-TOKEN` dans `X-XSRF-TOKEN`
     * (`core/interceptors/csrf/`). C'est la recopie qui prouve l'intention : un
     * site tiers ne peut pas lire ce cookie, seulement le faire envoyer.
     */
    enabled: true,

    /**
     * Route patterns to exclude from CSRF checks.
     * Useful for external webhooks or API endpoints.
     *
     * ⚠️ `/v1/auth/login` en fait partie : c'est la **première** requête d'écriture
     * d'une session, et aucun cookie `XSRF-TOKEN` n'existe encore à ce moment —
     * l'exiger rendrait la connexion impossible. Le risque de CSRF y est nul :
     * une connexion forcée n'accorde rien à l'attaquant, qui devrait de toute
     * façon connaître le mot de passe.
     *
     * Le webhook de paiement (§10.4) devra être ajouté ici le jour où il existera.
     */
    exceptRoutes: (ctx) => {
      // Une requête portant un `Authorization` **explicite** n'est pas
      // vulnérable au CSRF : un site tiers peut faire *envoyer* un cookie par le
      // navigateur, mais il ne peut pas fabriquer cet en-tête. Le CSRF ne
      // protège donc que l'authentification par cookie — c'est-à-dire les
      // navigateurs, et eux seuls.
      //
      // ⚠️ Ce test fonctionne parce que `shield` s'exécute **avant**
      // `bearer_from_cookie_middleware` : à ce stade l'en-tête n'a pas encore
      // été dérivé du cookie. Déplacer l'un des deux inverserait le sens de la
      // condition et désactiverait silencieusement toute la protection.
      if (ctx.request.header('authorization') !== undefined) return true

      // Sans cookie de session, il n'y a **rien à protéger** : le CSRF défend
      // contre l'usage involontaire d'une authentification ambiante, et il n'y
      // en a pas ici. Cela couvre naturellement la connexion et l'inscription —
      // les premières écritures d'une session, avant tout cookie `XSRF-TOKEN`.
      //
      // C'est aussi ce qui préserve les codes de retour : un appelant anonyme
      // doit recevoir **401** (non authentifié), pas 403 (CSRF manquant), sans
      // quoi l'API dirait « interdit » là où elle voulait dire « identifiez-vous ».
      return ctx.request.cookie(SESSION_COOKIE) === undefined
    },

    /**
     * Expose an encrypted XSRF-TOKEN cookie for frontend HTTP clients.
     */
    enableXsrfCookie: true,

    /**
     * ⚠️ Without this line, `shield` falls back to `config/app.ts`, whose domain
     * is empty: the cookie becomes *host-only* on the API, and is therefore
     * invisible to the front-end, which lives on another subdomain. It then has
     * nothing to copy into `X-XSRF-TOKEN`, and **every** cookie-authenticated
     * write returns a 403.
     *
     * `cookieScope()` is shared with the session cookie: both scopes must stay
     * identical, and two separate declarations would eventually diverge.
     */
    cookieOptions: cookieScope(),

    /**
     * HTTP methods protected by CSRF validation.
     */
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  /**
   * Control how your website should be embedded inside
   * iframes.
   */
  xFrame: {
    /**
     * Enable the X-Frame-Options header.
     */
    enabled: true,

    /**
     * Block all framing attempts. Default value is DENY.
     */
    action: 'DENY',
  },

  /**
   * Force browser to always use HTTPS.
   */
  hsts: {
    /**
     * Enable the Strict-Transport-Security header.
     */
    enabled: true,

    /**
     * HSTS policy duration remembered by browsers.
     */
    maxAge: '180 days',
  },

  /**
   * Disable browsers from sniffing content types and rely only
   * on the response content-type header.
   */
  contentTypeSniffing: {
    /**
     * Enable X-Content-Type-Options: nosniff.
     */
    enabled: true,
  },
})

export default shieldConfig
