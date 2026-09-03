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
const barcodeRule = () => vine.string().trim().minLength(1).maxLength(32).regex(/^\d+$/)

export const goodBarcodeValidator = vine.create({
  code: barcodeRule(),
})

/**
 * L'emplacement où se conserve une denrée (`goods.storage_location_id`).
 *
 * ⚠️ Ce n'est plus un enum : la liste vit dans `storage_locations` et le BAE la
 * tient lui-même depuis la page Référentiels. Il ne reste donc plus de CHECK à
 * heurter, seulement une clé étrangère — que le contrôleur vérifie pour rendre
 * un 404 franc plutôt qu'une violation en 500.
 *
 * `nullable` **et** `optional` disent deux choses différentes, et le contrôleur
 * s'appuie sur l'écart : absent = « ne touche pas à l'emplacement », `null` =
 * « efface-le ». Vine omet les clés absentes de sa sortie, ce qui rend la
 * distinction lisible par un simple `in`.
 */
const storageLocationIdRule = () => vine.number().withoutDecimals().positive().nullable().optional()

/**
 * Une denrée (`goods`).
 *
 * ⚠️ `unit` est un **enum en base** (`create_goods_table`) : sans cette règle une
 * valeur inconnue partait jusqu'à Postgres et revenait en 500.
 */
export const goodValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  unit: vine.enum(['pcs', 'kg', 'liter'] as const),
  brand: vine.string().trim().maxLength(255).optional(),
  categoryId: vine.number().withoutDecimals().positive().nullable().optional(),
  storageLocationId: storageLocationIdRule(),
  /** `barcodes` en principal, `barcode` seul toléré — cf. `codesFrom`. */
  barcodes: vine.array(barcodeRule()).optional(),
  barcode: barcodeRule().optional(),
})

/**
 * Tout optionnel : Vine omet les clés absentes, donc le contrôleur distingue
 * « efface » de « ne touche pas » par un simple test sur `undefined`.
 */
export const goodUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  unit: vine.enum(['pcs', 'kg', 'liter'] as const).optional(),
  brand: vine.string().trim().maxLength(255).nullable().optional(),
  categoryId: vine.number().withoutDecimals().positive().nullable().optional(),
  storageLocationId: storageLocationIdRule(),
})

/** ⚠️ `price` est en **centimes entiers** ; `quantity` compte des pièces. */
export const furnitureValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  quantity: vine.number().withoutDecimals().min(0),
  price: vine.number().withoutDecimals().min(0),
})

export const furnitureUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
  quantity: vine.number().withoutDecimals().min(0).optional(),
  price: vine.number().withoutDecimals().min(0).optional(),
})

/**
 * Le référentiel des lieux de stockage : « Frigo / Congélateur / Sec / Cave »,
 * et tout ce que le BAE y ajoutera.
 *
 * ⚠️ À ne pas confondre avec `categoryValidator` : une catégorie dit **ce
 * qu'est** une denrée, un lieu dit **où elle se range**. Une denrée porte les
 * deux, et les deux listes peuvent partager un mot.
 */
export const storageLocationValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
})

export const storageLocationUpdateValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255).optional(),
})
