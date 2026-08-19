import vine from '@vinejs/vine'

export const availabilityValidator = vine.create({
  isAvailable: vine.boolean(),
})

const eventFields = {
  name: vine.string().trim().minLength(1),
  date: vine.string(),
  duration: vine.number().positive().nullable().optional(),
  description: vine.string().nullable().optional(),
  status: vine.enum(['scheduled', 'ongoing', 'completed']).optional(),
  /** Plafond de précommandes. `0` ferme la soirée : il n'y a pas de pause. */
  capacity: vine.number().withoutDecimals().min(0).optional(),
  expectedAttendees: vine.number().withoutDecimals().min(0).nullable().optional(),
  /** Non nul = la prise en charge est active et une catégorie peut exister. */
  payerName: vine.string().trim().nullable().optional(),
  // En heures avant le début de la soirée ; `null` = suivre la valeur globale.
  preOrderCloseLeadHours: vine.number().withoutDecimals().min(0).nullable().optional(),
}

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
