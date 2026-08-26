import vine from '@vinejs/vine'

/**
 * ⚠️ Le nom est le **seul** champ écrivable : `Category` et `Supplier` ne portent
 * que lui. `CategoriesController` fusionnait `request.all()`, donc n'importe
 * quelle colonne — `id` compris — passait dans le modèle.
 */
export const categoryValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
})

/**
 * Tout optionnel : Vine omet les clés absentes de sa sortie, donc `merge()` ne
 * touche pas ce que le client n'a pas envoyé. Même règle que
 * `eventUpdateValidator`.
 */
export const categoryUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
})

export const supplierValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
})

export const supplierUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
})
