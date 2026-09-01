import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { seasonBounds, seasonLabel, seasonStartYear } from '#services/analytics_service'

test.group('Analytics — bornes de saison', () => {
  test('le 1er août ouvre une saison, le 31 juillet ferme la précédente', ({ assert }) => {
    assert.equal(seasonStartYear(DateTime.fromISO('2025-08-01T00:00:00')), 2025)
    assert.equal(seasonStartYear(DateTime.fromISO('2026-07-31T23:59:59')), 2025)
    assert.equal(seasonStartYear(DateTime.fromISO('2026-08-01T00:00:00')), 2026)
  })

  test('les bornes encadrent la saison, fin exclusive', ({ assert }) => {
    const { from, to } = seasonBounds(2025)
    assert.equal(from.toISODate(), '2025-08-01')
    assert.equal(to.toISODate(), '2026-08-01')
  })

  test('le libellé nomme les deux années', ({ assert }) => {
    assert.equal(seasonLabel(2025), 'Saison 2025-2026')
  })
})
