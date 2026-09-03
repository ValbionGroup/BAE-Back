import vine from '@vinejs/vine'

/**
 * Un mouvement de stock (`stock_movements`).
 *
 * ⚠️ `movementType` est un **enum en base** (`stock_movements_movement_type_check`),
 * pas du texte libre : sans cette règle, une valeur inconnue partait jusqu'à
 * Postgres et revenait en 500. Et `quantity` est une **quantité**, jamais un
 * montant — la denrée dit son unité (`goods.unit`), donc les décimales sont
 * légitimes ici, contrairement aux prix qui sont des centimes entiers.
 *
 * Les deux identifiants sont validés en forme seulement ; que le lot appartienne
 * bien à la denrée et qu'il porte encore la quantité demandée se vérifie dans le
 * contrôleur, en transaction, parce que ça se lit en base.
 */
export const stockMovementValidator = vine.create({
  goodId: vine.number().positive(),
  stockBatchId: vine.number().positive(),
  quantity: vine.number().positive(),
  movementType: vine.enum(['in', 'out'] as const),
})

/**
 * Tout optionnel : Vine omet les clés absentes de sa sortie, donc `merge()` ne
 * touche pas ce que le client n'a pas envoyé. Même règle que
 * `categoryUpdateValidator`.
 */
export const stockMovementUpdateValidator = vine.create({
  goodId: vine.number().positive().optional(),
  stockBatchId: vine.number().positive().optional(),
  quantity: vine.number().positive().optional(),
  movementType: vine.enum(['in', 'out'] as const).optional(),
})

/**
 * Un réapprovisionnement (`restocks`).
 *
 * ⚠️ `totalPrice` est en **centimes entiers**, comme tout montant : il partait
 * jusqu'ici sans contrôle de type ni de signe.
 */
export const restockValidator = vine.create({
  memberId: vine.number().withoutDecimals().positive().nullable().optional(),
  supplierId: vine.number().withoutDecimals().positive().nullable().optional(),
  totalPrice: vine.number().withoutDecimals().min(0),
})

export const restockUpdateValidator = vine.create({
  memberId: vine.number().withoutDecimals().positive().nullable().optional(),
  supplierId: vine.number().withoutDecimals().positive().nullable().optional(),
  totalPrice: vine.number().withoutDecimals().min(0).optional(),
})

/**
 * Un lot entré en stock (`stock_batches`).
 *
 * ⚠️ `quantity` est un `decimal(10, 2) unsigned` : les décimales sont légitimes
 * — une denrée se compte au kilo — le négatif non. `label` reste optionnel,
 * `nextLabel()` le tire quand il manque.
 */
export const stockBatchValidator = vine.create({
  goodId: vine.number().withoutDecimals().positive(),
  restockId: vine.number().withoutDecimals().positive().nullable().optional(),
  quantity: vine.number().min(0),
  label: vine.string().trim().minLength(1).maxLength(255).optional(),
  expirationDate: vine
    .date({ formats: ['iso8601'] })
    .nullable()
    .optional(),
})

export const stockBatchUpdateValidator = vine.create({
  goodId: vine.number().withoutDecimals().positive().optional(),
  restockId: vine.number().withoutDecimals().positive().nullable().optional(),
  quantity: vine.number().min(0).optional(),
  label: vine.string().trim().minLength(1).maxLength(255).optional(),
  expirationDate: vine
    .date({ formats: ['iso8601'] })
    .nullable()
    .optional(),
})
