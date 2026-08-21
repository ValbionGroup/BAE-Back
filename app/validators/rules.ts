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

/**
 * La règle des mots de passe **qu'on écrit aujourd'hui** : douze caractères, une
 * majuscule, un chiffre. Elle existe à côté de `passwordRule()` et ne la remplace
 * pas, parce que celle-ci garde `signupValidator` : la resserrer changerait le
 * comportement d'un endpoint que personne n'a demandé de toucher.
 *
 * Ces trois exigences ne sont pas choisies ici : la page Sécurité affiche
 * « ≥ 12 caractères · 1 majuscule · 1 chiffre » et sa jauge de force note
 * exactement ces trois règles. L'API ne fait que cesser de contredire l'écran.
 *
 * Le plafond est à 72 et non aux 32 de `passwordRule()` : scrypt n'a pas de limite
 * d'entrée, et 32 caractères écartent les phrases de passe comme les sorties de
 * gestionnaire de mots de passe sans rien protéger.
 */
export const strongPasswordRule = () =>
  vine.string().minLength(12).maxLength(72).regex(/[A-Z]/).regex(/\d/)
