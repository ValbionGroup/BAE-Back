/**
 * Une URL d'IdP sert **deux consommateurs qui ne l'atteignent pas pareil**.
 *
 * Les métadonnées OIDC portent d'un côté `authorization_endpoint`, que le
 * **navigateur** suit, et de l'autre `token_endpoint` / `userinfo_endpoint`, que
 * le **serveur** appelle. Tant que les deux passent par la même adresse
 * publique, la distinction ne se voit pas. Elle apparaît dès que l'API tourne
 * ailleurs que le navigateur : en conteneur, derrière un réseau interne, ou
 * dans un maillage de services.
 *
 * L'erreur naturelle est alors de changer `KEYCLOAK_ISSUER` pour l'adresse que
 * le serveur sait joindre. La découverte repart, la redirection aussi — et c'est
 * le **navigateur** qui échoue, sur un nom d'hôte interne qu'il ne résout pas.
 * La panne se déplace au lieu de disparaître, et se déguise en problème d'IdP.
 *
 * D'où la séparation : `KEYCLOAK_ISSUER` reste l'adresse **publique** (celle du
 * navigateur, et celle que le claim `iss` doit porter), et `KEYCLOAK_INTERNAL_URL`
 * décrit, quand elle diffère, le chemin **serveur → IdP**. Seules les requêtes
 * sortantes du serveur sont réécrites ; les métadonnées ne sont jamais touchées.
 *
 * ⚠️ Suppose que l'IdP annonce une adresse publique stable, sans quoi la
 * découverte rejetterait un `issuer` différent de celui demandé. Côté Keycloak
 * c'est l'attribut de realm `frontendUrl` — posé par
 * `scripts/setup-dev-keycloak.sh` — sans lequel les URL sont dérivées de
 * l'en-tête `Host` de l'appelant.
 */
export function backchannelUrl(target: URL | string, internal: string | undefined | null): URL {
  const url = new URL(target instanceof URL ? target.href : target)

  if (!internal) return url

  const { protocol, host } = new URL(internal)
  url.protocol = protocol
  url.host = host

  return url
}
