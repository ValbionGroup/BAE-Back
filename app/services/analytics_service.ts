import { DateTime } from 'luxon'

/** Une saison va du 1er août au 31 juillet ; `startYear` est l'année d'août. */
export interface SeasonRef {
  startYear: number
  label: string
}

const SEASON_START_MONTH = 8

export function seasonStartYear(date: DateTime): number {
  return date.month >= SEASON_START_MONTH ? date.year : date.year - 1
}

/** `to` est **exclusif** : il vaut le 1er août suivant, pas le 31 juillet. */
export function seasonBounds(startYear: number): { from: DateTime; to: DateTime } {
  return {
    from: DateTime.fromObject({ year: startYear, month: SEASON_START_MONTH, day: 1 }).startOf('day'),
    to: DateTime.fromObject({ year: startYear + 1, month: SEASON_START_MONTH, day: 1 }).startOf(
      'day'
    ),
  }
}

export function seasonLabel(startYear: number): string {
  return `Saison ${startYear}-${startYear + 1}`
}
