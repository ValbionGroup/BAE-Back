/**
 * Lit le code d'erreur d'une réponse d'API.
 *
 * ⚠️ Le cast est nécessaire, et il n'est pas un contournement paresseux : le type
 * du corps est **inféré depuis le type de retour du contrôleur**, qui ne décrit
 * que le cas de succès (`{ data }`). L'enveloppe d'erreur (`{ error: { code,
 * message } }`) est produite par le gestionnaire d'exceptions, hors de cette
 * inférence — elle n'apparaît donc dans aucun type généré.
 *
 * Concentré ici parce que le registre `.adonisjs/**` est **régénéré** à chaque
 * démarrage du serveur : une spec qui accède à `.error` directement compile tant
 * que le registre est périmé, puis casse au premier ajout de route sans que
 * personne n'ait touché à la spec.
 */
export function errorCodeOf(response: { body(): unknown }): string | undefined {
  const body = response.body() as { error?: { code?: string } } | null
  return body?.error?.code
}
