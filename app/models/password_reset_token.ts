import { PasswordResetTokenSchema } from '#database/schema'

/**
 * Aucune relation vers `User` déclarée : le seul parcours de ce modèle est
 * « retrouver la ligne d'un jeton », et `app/models/user.ts` documente qu'ajouter
 * des relations inverses sur `User` fait abandonner l'inférence de types de Lucid
 * **globalement**. Passer par `User.find(row.userId)`.
 */
export default class PasswordResetToken extends PasswordResetTokenSchema {}
