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

/**
 * Le référentiel de **vente** : « Plats / Desserts / Boissons ».
 *
 * ⚠️ À ne pas confondre avec `categoryValidator`, qui classe les **denrées** pour
 * le stockage. Les deux vocabulaires sont distincts et peuvent partager un mot.
 */
export const productCategoryValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
})

export const productCategoryUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
})

/**
 * Un code-barres rattaché à une denrée (`good_barcodes.code`).
 *
 * Chiffres seuls : les symbologies que lit le scanner (EAN-8, EAN-13, UPC-A,
 * ITF-14) sont toutes numériques. Refuser le reste ici évite qu'une saisie
 * manuelle avec espaces ou tiret crée un second code pour la même boîte — le
 * front normalise déjà (`rawCode.replace(/\s/g, '')`), mais la saisie n'est pas
 * la seule porte d'entrée.
 */
export const goodBarcodeValidator = vine.create({
  code: vine.string().trim().minLength(1).maxLength(32).regex(/^\d+$/),
})

/**
 * Le mode de conservation d'une denrée (`goods.storage_method`) — « Signaler la
 * méthode de stockage », P1 du CDC.
 *
 * La liste de référence vit ici : c'est le seul point que le contrôleur, le
 * front et les tests partagent. La migration en garde une copie figée, exprès.
 *
 * ⚠️ Sans cette validation, une valeur hors liste atteint le CHECK que
 * `table.enum()` a posé et ressort en **500**, pas en 422 — le même piège que
 * `goods.unit`, à ceci près qu'ici la valeur est aussi écrivable par PATCH.
 *
 * `nullable` **et** `optional` disent deux choses différentes, et le contrôleur
 * s'appuie sur l'écart : absent = « ne touche pas à l'emplacement », `null` =
 * « efface-le ». Vine omet les clés absentes de sa sortie, ce qui rend la
 * distinction lisible par un simple `in`.
 */
export const STORAGE_METHODS = ['fridge', 'freezer', 'dry', 'cellar'] as const

export type StorageMethod = (typeof STORAGE_METHODS)[number]

export const goodStorageMethodValidator = vine.create({
  storageMethod: vine.enum(STORAGE_METHODS).nullable().optional(),
})
