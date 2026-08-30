/**
 * Le corps lisible d'une notification, tel que les émetteurs l'écrivent.
 *
 * Le driver `pg` rend une colonne JSON tantôt en objet, tantôt en chaîne selon le
 * chemin de lecture : les deux distributeurs passent donc par ici.
 */
export function readNotificationPayload(raw: unknown): { subject: string; lines: string[] } {
  const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
    subject?: string
    lines?: string[]
  } | null

  return {
    subject: parsed?.subject ?? 'Notification BAE',
    lines: parsed?.lines ?? [],
  }
}
