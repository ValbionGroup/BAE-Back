import { createHmac, randomBytes } from 'node:crypto'
import env from '#start/env'

/**
 * Alphabet base32 de Crockford : les dix chiffres et vingt-deux lettres, sans
 * `I`, `L`, `O` ni `U`. Les trois premières se confondent avec `1` et `0` sur un
 * code recopié à la main depuis un bout de papier — ce que sont précisément les
 * codes de secours — et `U` est écarté pour éviter les mots malheureux.
 *
 * Trente-deux symboles, soit une puissance de deux : un masque sur cinq bits
 * suffit à tirer un caractère **sans biais**, là où un modulo sur un alphabet de
 * taille quelconque favoriserait ses premiers symboles.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const RECOVERY_CODE_LENGTH = 10

const LINK_CODE_LENGTH = 12

/**
 * Empreinte d'un secret à usage unique : HMAC-SHA256 clé par `APP_KEY`.
 *
 * Ce n'est volontairement **pas** `hash.make()`, et les trois raisons comptent :
 *
 * 1. Une empreinte scrypt ne s'indexe pas. Vérifier un code de secours imposerait
 *    de charger les dix lignes du compte et d'exécuter jusqu'à dix scrypt à
 *    coût 16384 — des centaines de millisecondes, sur un endpoint dont
 *    l'attaquant choisit la cadence. Ici, un `WHERE code_digest = ?` indexé suffit.
 * 2. Un KDF mémoire-dur ne protège rien de plus : ces valeurs sortent d'un CSPRNG,
 *    pas d'un choix humain, donc il n'existe aucun dictionnaire à ralentir.
 * 3. Mais un hachage rapide *nu* serait insuffisant pour cinquante bits d'entropie.
 *    La clé — absente de la base — rend une fuite de la base seule (sauvegarde,
 *    dump de réplica) inexploitable hors ligne.
 *
 * ⚠️ Corollaire : roter `APP_KEY` invalide tous les codes de secours et tous les
 * jetons de réinitialisation en circulation. C'est acceptable parce que la rotation
 * invalide déjà tout cookie signé et toute valeur chiffrée de l'application.
 */
export function digest(value: string): string {
  return createHmac('sha256', env.get('APP_KEY').release()).update(value).digest('hex')
}

/**
 * Empreinte d'un code de secours, insensible à la casse et à la ponctuation : il
 * est lu sur un papier et retapé à la main, donc `abcde-fghij`, `ABCDE-FGHIJ` et
 * `ABCDEFGHIJ` doivent désigner le même code.
 *
 * ⚠️ Ne jamais faire passer un jeton de réinitialisation par ici. Un jeton est du
 * base64url, donc **sensible à la casse** : le normaliser en majuscules en ferait
 * une valeur qui ne correspond plus à rien. Les jetons utilisent `digest()` tel quel.
 */
export function digestRecoveryCode(code: string): string {
  return digest(normaliseRecoveryCode(code))
}

export function normaliseRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase()
}

/** Jeton opaque pour un lien de réinitialisation : 32 octets en base64url. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Un code de secours : dix symboles base32, présentés en deux groupes de cinq.
 * Cinquante bits d'entropie — hors de portée d'une devinette en ligne, et la
 * coupure rend la recopie manuelle nettement moins fautive.
 */
export function randomRecoveryCode(): string {
  const raw = Array.from(randomBytes(RECOVERY_CODE_LENGTH), (byte) => ALPHABET[byte & 31]).join('')
  return `${raw.slice(0, 5)}-${raw.slice(5)}`
}

/**
 * Le code d'un deep-link Telegram : douze symboles base32, soixante bits.
 *
 * L'alphabet est déjà inclus dans le `[A-Za-z0-9_-]` qu'exige Telegram, et douze
 * caractères tiennent largement sous sa limite de soixante-quatre — tout en
 * restant retapables à la main quand le lien n'ouvre rien.
 */
export function randomLinkCode(): string {
  return Array.from(randomBytes(LINK_CODE_LENGTH), (byte) => ALPHABET[byte & 31]).join('')
}

/** Le code voyage dans une URL et peut être retapé : la casse ne doit pas compter. */
export function normaliseLinkCode(code: string): string {
  return code.trim().toUpperCase()
}
