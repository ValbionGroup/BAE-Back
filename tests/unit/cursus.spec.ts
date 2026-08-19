import { test } from '@japa/runner'
import { formatCursus } from '#services/cursus'

test.group('Cursus — libellé de promotion depuis le code IdP', () => {
  test('traduit chaque filière', ({ assert }) => {
    assert.equal(formatCursus('IIEIN3'), 'Informatique 1A')
    assert.equal(formatCursus('IIETE4'), 'Télécommunications 2A')
    assert.equal(formatCursus('IIEMM5'), 'MATMECA 3A')
    assert.equal(formatCursus('IIEEL3'), 'Électronique 1A')
    assert.equal(formatCursus('IAERI4'), 'Réseaux & Informatique 2A')
    assert.equal(formatCursus('IAESE5'), 'Systèmes électroniques embarqués 3A')
  })

  test('traduit chaque année, 3 valant la première', ({ assert }) => {
    assert.equal(formatCursus('IIEIN3'), 'Informatique 1A')
    assert.equal(formatCursus('IIEIN4'), 'Informatique 2A')
    assert.equal(formatCursus('IIEIN5'), 'Informatique 3A')
    assert.equal(formatCursus('IIEIN6'), 'Informatique 4A')
  })

  test('tolère la casse et les espaces autour', ({ assert }) => {
    assert.equal(formatCursus('  iiein3 '), 'Informatique 1A')
  })

  test('rend null quand le claim est absent ou vide', ({ assert }) => {
    assert.isNull(formatCursus(null))
    assert.isNull(formatCursus(''))
    assert.isNull(formatCursus('   '))
  })

  test('préserve un code inconnu plutôt que de perdre l’information', ({ assert }) => {
    // Une filière ouverte après l'écriture de cette table doit rester lisible
    // dans la fiche, quitte à l'être sous sa forme brute.
    assert.equal(formatCursus('IIEXX3'), 'IIEXX3')
    assert.equal(formatCursus('IIEIN9'), 'IIEIN9')
    assert.equal(formatCursus('n’importe quoi'), 'n’importe quoi')
  })
})
