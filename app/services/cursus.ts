/**
 * Traduction du code de diplôme transmis par le CAS/OIDC en libellé lisible.
 *
 * L'IdP envoie un code compact (`IIEIN3`) : cinq lettres pour la filière, un
 * chiffre pour l'année. Stocké tel quel dans `clients.promotion`, il n'a aucun
 * sens pour le bureau qui lit une fiche d'adhérent.
 *
 * Le chiffre part de **3**, pas de 1 : l'école numérote ses années dans le
 * cursus post-bac, la 1re année d'école étant la 3e année d'études.
 */

const FILIERES: Record<string, string> = {
  IIEIN: 'Informatique',
  IIETE: 'Télécommunications',
  IIEMM: 'MATMECA',
  IIEEL: 'Électronique',
  IAERI: 'Réseaux & Informatique',
  IAESE: 'Systèmes électroniques embarqués',
}

const ANNEES: Record<string, string> = { '3': '1A', '4': '2A', '5': '3A', '6': '4A' }

/**
 * Rend `null` si le claim est absent, et le code brut si la table ne le connaît
 * pas — une filière ouverte après cette table doit rester lisible dans la fiche
 * plutôt que disparaître.
 */
export function formatCursus(code: string | null): string | null {
  if (code === null) return null

  const trimmed = code.trim()
  if (trimmed === '') return null

  const normalized = trimmed.toUpperCase()
  const filiere = FILIERES[normalized.slice(0, 5)]
  const annee = ANNEES[normalized.slice(5)]
  if (filiere === undefined || annee === undefined) return trimmed

  return `${filiere} ${annee}`
}
