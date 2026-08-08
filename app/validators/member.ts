import vine from '@vinejs/vine'

/**
 * Corps de `PATCH|PUT /v1/members/:id`.
 *
 * Les trois champs sont `optional()` : le corps est un delta. C'est ce qui
 * distingue « champ absent » de « champ vidé » — sans quoi un PATCH ne portant
 * que `roleId` écrivait `undefined` dans `first_name` et `last_name`.
 *
 * `roleId` est `nullable()` ET `optional()`, et les deux comptent : `null` est
 * une valeur légitime qui signifie « sans rôle », `undefined` signifie « ne
 * touche pas au rôle ». Le contrôleur teste donc `!== undefined`, jamais la
 * véracité.
 */
export const updateMemberValidator = vine.create({
  firstName: vine.string().trim().minLength(1).maxLength(255).optional(),
  lastName: vine.string().trim().minLength(1).maxLength(255).optional(),
  roleId: vine.number().positive().nullable().optional(),
})
