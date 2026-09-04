import type { JobPeriod } from '#services/matching_service'

/**
 * Les libellés français des trois moments d'une soirée. Vivaient dans
 * `assignments_controller`, d'où le rendu des notifications les aurait recopiés —
 * deux tables auraient divergé au premier renommage.
 */
export const PERIOD_LABELS: Record<JobPeriod, string> = {
  before: 'Avant · Préparation',
  during: 'Pendant · Service',
  after: 'Après · Nettoyage',
}
