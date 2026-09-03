import { test } from '@japa/runner'
import { normalizePhone } from '#services/phone_number'

/**
 * Le numéro voyage jusqu'à Lydia, qui identifie le caissier avec. Un format
 * approximatif y échoue sans rien dire d'utile : la frontière est ici.
 */
test.group('Normalisation d’un téléphone', () => {
  test('accepte les formes qu’un humain tape et rend du E.164', ({ assert }) => {
    assert.equal(normalizePhone('0612345678'), '+33612345678')
    assert.equal(normalizePhone('06 12 34 56 78'), '+33612345678')
    assert.equal(normalizePhone('06.12.34.56.78'), '+33612345678')
    assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678')
    assert.equal(normalizePhone('0033612345678'), '+33612345678')
  })

  test('accepte un mobile étranger écrit en international', ({ assert }) => {
    assert.equal(normalizePhone('+32 470 12 34 56'), '+32470123456')
  })

  /** Lydia est un portefeuille mobile : un fixe ne peut pas y être rattaché. */
  test('refuse un fixe', ({ assert }) => {
    assert.throws(() => normalizePhone('0142345678'))
  })

  test('refuse ce qui n’est pas un numéro', ({ assert }) => {
    assert.throws(() => normalizePhone('06 12 34'))
    assert.throws(() => normalizePhone('pas un numéro'))
    assert.throws(() => normalizePhone(''))
  })
})
