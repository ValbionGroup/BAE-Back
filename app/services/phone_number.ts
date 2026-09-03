/**
 * `/max` et non l'entrée par défaut : seules ces métadonnées portent le type du
 * numéro. Sans elles `getType()` rend `undefined`, et la règle « mobile
 * uniquement » rejetterait tout, mobiles compris.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import ApiException from '#exceptions/api_exception'

/** Le pays supposé quand le numéro est écrit sans indicatif — le BAE est à Bordeaux. */
const DEFAULT_COUNTRY = 'FR'

/**
 * Rend le numéro en E.164 (`+33612345678`), seule forme sans ambiguïté de pays.
 *
 * ⚠️ C'est aussi la forme envoyée à Lydia (`phone`), faute d'avoir pu vérifier
 * ce qu'ils attendent : leur homologation refuse nos jetons. S'ils exigeaient
 * le national, la conversion se ferait à l'appel, pas au stockage.
 *
 * Les fixes sont refusés : Lydia est un portefeuille mobile, un fixe n'y est
 * rattaché à aucun compte.
 */
export function normalizePhone(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY)

  if (!parsed?.isValid()) {
    throw new ApiException('E_PHONE_INVALID', "Ce numéro de téléphone n'est pas valide.", 422)
  }

  if (parsed.getType() !== 'MOBILE') {
    throw new ApiException(
      'E_PHONE_NOT_MOBILE',
      'Lydia demande un mobile : ce numéro n’en est pas un.',
      422
    )
  }

  return parsed.number
}
