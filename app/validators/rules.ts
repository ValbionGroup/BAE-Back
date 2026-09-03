import vine from '@vinejs/vine'

/**
 * Les règles partagées par les validateurs qui portent sur un compte, isolées
 * pour une raison d'ordre d'amorçage : `unique()` n'est pas une règle de Vine,
 * c'est le provider de Lucid qui l'installe sur `VineString` au démarrage.
 *
 * ⚠️ Ace charge les modules de `commands/` **avant** l'amorçage, `node ace list`
 * compris. Une commande ne peut donc pas importer un validateur portant
 * `unique()` — elle importe ce module, qui ne dépend que de Vine.
 */
export const emailRule = () => vine.string().email().maxLength(254)

/**
 * Douze caractères, une majuscule, un chiffre — ce qu'affiche la page Sécurité
 * du dashboard, jauge de force comprise.
 *
 * ⚠️ Une seconde règle plus lâche (8 caractères, sans composition) a existé ici
 * pour l'inscription libre, depuis supprimée. Ne pas la réintroduire : de deux
 * politiques de mot de passe, seule la plus faible compte.
 *
 * Le plafond est à 72 et non 32 : scrypt n'a pas de limite d'entrée, et 32
 * écartait les phrases de passe comme les sorties de gestionnaire.
 */
export const strongPasswordRule = () =>
  vine.string().minLength(12).maxLength(72).regex(/[A-Z]/).regex(/\d/)
