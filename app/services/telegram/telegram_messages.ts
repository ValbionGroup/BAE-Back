import type { RedeemOutcome } from './telegram_link_service.js'

/**
 * Ce que le bot répond, en texte brut. Aucun `parse_mode` : MarkdownV2 échoue en
 * 400 sur un `.`, un `-` ou un `!` non échappé, et ces textes en contiennent.
 */
export function redeemReply(outcome: RedeemOutcome): string {
  switch (outcome.kind) {
    case 'linked':
      return 'C’est fait. Ce compte Telegram est lié à ton profil BAE — tu recevras ici les mêmes notifications que par e-mail. Envoie /stop pour te délier.'
    case 'already_linked_here':
      return 'Ton compte est déjà lié. Rien à faire.'
    case 'expired':
      return 'Ce lien a expiré (il est valable 15 minutes). Génère-s’en un nouveau depuis la page Mon profil.'
    case 'chat_taken':
      return 'Ce compte Telegram est déjà lié à un autre profil BAE. Délie-le d’abord depuis ce profil-là.'
    case 'unknown_code':
      return 'Ce lien n’est pas valide. Repars de la page Mon profil sur le site du BAE pour en générer un nouveau.'
  }
}

export const START_WITHOUT_CODE =
  'Bonjour. Pour recevoir tes notifications ici, va sur la page Mon profil du site du BAE et clique sur « Lier mon compte Telegram ».'

export const UNLINKED = 'C’est délié. Tu ne recevras plus rien ici.'

export const NOT_LINKED = 'Ce compte Telegram n’est lié à aucun profil BAE.'
