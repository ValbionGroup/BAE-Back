import { test } from '@japa/runner'
import { describeFetchFailure } from '#services/lydia/http_lydia_client'

/**
 * Ces tests gardent la **lisibilité d'une panne**, pas un comportement métier.
 *
 * « Lydia est injoignable » couvre indifféremment un DNS absent, un port fermé,
 * un délai dépassé et un certificat rejeté — quatre pannes qui n'ont pas le même
 * correctif. Undici range la distinction dans `cause`, et la perdre condamne à
 * deviner le jour où ça tombe.
 */
test.group('Diagnostic d’un échec de transport Lydia', () => {
  /** Le défaut visé : le code d'erreur réseau perdu, donc la panne indevinable. */
  test('le code de la cause est conservé', ({ assert }) => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND lydia-app.com'), {
      code: 'ENOTFOUND',
    })
    const failure = new Error('fetch failed', { cause })

    assert.include(describeFetchFailure(failure), 'ENOTFOUND')
  })

  /**
   * Le défaut visé : une cause sans `code` — certificat, abandon — réduite à
   * rien parce qu'on n'a cherché que `code`.
   */
  test('une cause sans code garde au moins son message', ({ assert }) => {
    const failure = new Error('fetch failed', { cause: new Error('certificate has expired') })

    assert.include(describeFetchFailure(failure), 'certificate has expired')
  })

  /**
   * Le défaut visé : planter dans le gestionnaire d'erreur. Un `throw` ici
   * remplacerait un 502 lisible par une trace sans rapport.
   */
  test('une valeur qui n’est pas une erreur ne fait pas planter le diagnostic', ({ assert }) => {
    assert.isString(describeFetchFailure('boom'))
    assert.isString(describeFetchFailure(undefined))
  })
})
