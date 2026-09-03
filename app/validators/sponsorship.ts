import vine from '@vinejs/vine'

/**
 * `external` : un tiers rembourse l'écart, réclamé sur le justificatif.
 * `internal` : le BAE l'offre — perte sèche assumée, jamais recouvrée.
 */
export const SPONSORSHIP_MODES = ['external', 'internal'] as const

export const sponsorshipCategoryValidator = vine.create({
  label: vine.string().trim().minLength(1),
  mode: vine.enum(SPONSORSHIP_MODES),
  /** `null` ou absent : le QR ne se périme pas au compteur. */
  maxOrders: vine.number().withoutDecimals().positive().nullable().optional(),
})

/**
 * Tout optionnel : Vine omet les clés absentes, donc renommer sans toucher au
 * mode n'entraîne pas la vérification du verrou de bascule.
 */
export const sponsorshipCategoryPatchValidator = vine.create({
  label: vine.string().trim().minLength(1).optional(),
  mode: vine.enum(SPONSORSHIP_MODES).optional(),
  maxOrders: vine.number().withoutDecimals().positive().nullable().optional(),
})

export const sponsorshipPricesValidator = vine.create({
  prices: vine.array(
    vine.object({
      productId: vine.number().positive(),
      // `null` retire la ligne : l'article repasse au prix public.
      priceCents: vine.number().withoutDecimals().min(0).nullable(),
    })
  ),
})
