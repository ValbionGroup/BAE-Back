/**
 * Traduction du code de diplôme transmis par le CAS/OIDC en libellé lisible.
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
