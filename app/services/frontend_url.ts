import env from '#start/env'
import type { SsoApp } from '#services/sso_provisioning_service'

/**
 * L'origine du front à qui l'on s'adresse. Extrait de
 * `keycloak_auth_controller` le jour où la réinitialisation de mot de passe a eu
 * besoin de construire un lien : deux consommateurs, une seule table de
 * correspondance.
 *
 * ⚠️ La zone est toujours résolue côté serveur, à partir d'un mot-clé d'une liste
 * fermée. Accepter une URL de retour du client — même « juste pour le lien du
 * mail » — serait une redirection ouverte offerte à qui veut hameçonner.
 */
export function frontendUrl(app: SsoApp): string {
  return app === 'dashboard' ? env.get('DASHBOARD_URL') : env.get('PUBLIC_APP_URL')
}
