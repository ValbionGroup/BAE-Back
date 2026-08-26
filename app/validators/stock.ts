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
