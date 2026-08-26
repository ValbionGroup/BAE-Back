import vine from '@vinejs/vine'

export const availabilityValidator = vine.create({
  isAvailable: vine.boolean(),
})

const eventFields = {
  name: vine.string().trim().minLength(1),
  date: vine.string(),
  duration: vine.number().positive().nullable().optional(),
  description: vine.string().nullable().optional(),
  /** Plafond de précommandes. `0` ferme la soirée : il n'y a pas de pause. */
  capacity: vine.number().withoutDecimals().min(0).optional(),
  expectedAttendees: vine.number().withoutDecimals().min(0).nullable().optional(),
  /** Non nul = la prise en charge est active et une catégorie peut exister. */
  payerName: vine.string().trim().nullable().optional(),
  // En heures avant le début de la soirée ; `null` = suivre la valeur globale.
  preOrderCloseLeadHours: vine.number().withoutDecimals().min(0).nullable().optional(),
}

/**
 * ⚠️ **`status` n'est pas ici, et ne doit pas y revenir.** L'état d'une soirée a
 * exactement deux portes — `POST /events/:id/open` et `POST /events/:id/settle`
 * — parce que chacune porte une règle qu'un PATCH générique contournerait :
 * l'unicité de la soirée ouverte, et la consolidation des points à la clôture.
 * Une clé inconnue est ignorée par Vine, donc un client qui l'enverrait encore
 * ne casse pas ; il n'obtient simplement aucun effet.
 */
export const eventValidator = vine.create(eventFields)

/**
 * Tout est optionnel : Vine omet les clés absentes de sa sortie, donc `merge()`
 * ne touche pas ce que le client n'a pas envoyé. Sans ça, un PATCH partiel
 * efface les colonnes qu'il ne mentionne pas.
 */
export const eventUpdateValidator = vine.create({
  ...eventFields,
  name: vine.string().trim().minLength(1).optional(),
  date: vine.string().optional(),
})
