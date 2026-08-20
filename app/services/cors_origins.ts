/**
 * L'allowlist CORS de production, dérivée des URL des deux fronts.
 *
 * ⚠️ **Un `Origin` HTTP vaut toujours `scheme://host[:port]`.** La liste écrite à
 * la main valait `['bae.eirb.fr', 'dashboard.bae.eirb.fr', 'order.bae.eirb.fr']`
 * — sans schéma, donc **aucune de ces valeurs ne pouvait matcher** : en
 * production, tout appel navigateur aurait été refusé. Le défaut était invisible
 * en développement, où `origin: true` accepte tout.
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
