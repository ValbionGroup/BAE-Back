import vine from '@vinejs/vine'

/**
 * Les règles partagées par les validateurs qui portent sur un compte, isolées
 * de `#validators/user` pour une raison d'ordre d'amorçage : `unique()` n'est pas
 * une règle de Vine, c'est le provider de Lucid qui l'installe sur `VineString`
 * au démarrage. `signupValidator` l'évalue à l'import, donc importer
 * `#validators/user` avant que l'application ne soit amorcée lève
 * `email(...).unique is not a function`.
 *
 * ⚠️ Or c'est exactement ce que fait Ace : il charge les modules de `commands/`
 * pour lire leurs métadonnées **avant** l'amorçage, `node ace list` et
 * `node ace <cmd> --help` compris. Une commande ne peut donc pas importer
 * `#validators/user` — elle importe ce module, qui ne dépend que de Vine.
 */
export const emailRule = () => vine.string().email().maxLength(254)
export const passwordRule = () => vine.string().minLength(8).maxLength(32)
