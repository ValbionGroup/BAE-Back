import { TelegramLinkCodeSchema } from '#database/schema'

/**
 * Aucune relation vers `User`, pour la raison documentée dans `app/models/user.ts` :
 * les relations inverses y font perdre l'inférence de types de Lucid globalement.
 */
export default class TelegramLinkCode extends TelegramLinkCodeSchema {}
