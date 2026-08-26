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

/**
 * Le tarif d'une denrée chez une enseigne (`good_suppliers.price`).
 *
 * ⚠️ **En centimes entiers**, comme tout montant depuis le 2026-08-25, et
 * **par unité de stock** (`goods.unit` : `pcs`, `kg` ou `liter`). Rien ne
 * normalise les conditionnements : `pricing_service` compare les prix bruts
 * entre enseignes, donc un prix « au sac de 5 kg » face à un prix « au kilo »
 * fausserait la comparaison **et** le prix de référence. L'écran le dit à la
 * saisie (« Prix par kg »).
 */
export const supplierPriceValidator = vine.create({
  priceCents: vine.number().withoutDecimals().min(0),
})
