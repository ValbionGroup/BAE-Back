/**
 * L'allowlist CORS de production, dérivée des URL des deux fronts.
 *
 * ⚠️ **Un `Origin` HTTP vaut toujours `scheme://host[:port]`.** Une liste écrite
 * à la main y valait des noms d'hôtes nus — sans schéma, donc **aucune de ces
 * valeurs ne pouvait matcher** : en production, tout appel navigateur aurait été
 * refusé. Le défaut était invisible en développement, où `origin: true` accepte
 * tout. C'est la raison d'être de cette dérivation.
 *
 * Domaines de production au 2026-08-26 : `erp.bae.valbion.com` (dashboard) et
 * `bae.valbion.com` (public), l'API étant sur `api.bae.valbion.com`.
 *
 * Dérivée de `DASHBOARD_URL` / `PUBLIC_APP_URL` et non redéclarée : ce sont déjà
 * les destinations vers lesquelles le callback SSO redirige. Deux listes des
 * mêmes origines finiraient par diverger, et l'écart ne se verrait qu'en prod.
 */
export function allowedOrigins(urls: readonly string[]): string[] {
  const origins = new Set<string>()

  for (const url of urls) {
    try {
      // `new URL(...).origin` rend exactement `scheme://host[:port]`, sans
      // chemin ni barre finale — c'est la forme que le navigateur envoie.
      origins.add(new URL(url).origin)
    } catch {
      // Une URL illisible est ignorée plutôt que propagée telle quelle : la
      // laisser passer produirait une entrée qui ne matche rien, c'est-à-dire
      // exactement le défaut qu'on corrige ici.
    }
  }

  return [...origins]
}
