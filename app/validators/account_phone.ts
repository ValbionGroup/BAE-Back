import vine from '@vinejs/vine'

/**
 * `null` efface le numéro. La forme du numéro n'est pas vérifiée ici mais par
 * `normalizePhone` : VineJS dirait « invalide » là où la lib sait dire « ce
 * n'est pas un mobile ».
 */
export const updateAccountPhoneValidator = vine.create({
  phone: vine.string().trim().maxLength(32).nullable(),
})
