import { test } from '@japa/runner'
import { allowedOrigins } from '#services/cors_origins'

test.group('Allowlist CORS', () => {
  test('rend des origines complètes, avec leur schéma', ({ assert }) => {
    const origins = allowedOrigins(['https://dashboard.bae.eirb.fr', 'https://order.bae.eirb.fr'])

    assert.deepEqual(origins, ['https://dashboard.bae.eirb.fr', 'https://order.bae.eirb.fr'])
  })

  /**
   * ⚠️ Le test qui garde le bug corrigé : un `Origin` HTTP porte toujours son
   * schéma, donc une entrée qui n'en a pas ne matche **jamais**. C'est ce que
   * l'ancienne liste écrite à la main contenait.
   */
  test('aucune entrée ne peut être un simple nom d’hôte', ({ assert }) => {
    const origins = allowedOrigins(['https://dashboard.bae.eirb.fr'])

    for (const origin of origins) {
      assert.isTrue(
        origin.startsWith('http://') || origin.startsWith('https://'),
        `« ${origin} » ne matchera aucun en-tête Origin`
      )
    }
  })

  test('retire le chemin et la barre finale', ({ assert }) => {
    const origins = allowedOrigins([
      'https://dashboard.bae.eirb.fr/',
      'https://order.bae.eirb.fr/login',
    ])

    assert.deepEqual(origins, ['https://dashboard.bae.eirb.fr', 'https://order.bae.eirb.fr'])
  })

  test('conserve le port, qui fait partie de l’origine', ({ assert }) => {
    const origins = allowedOrigins(['http://localhost:4200'])

    assert.deepEqual(origins, ['http://localhost:4200'])
  })

  test('déduplique deux URL de même origine', ({ assert }) => {
    const origins = allowedOrigins([
      'https://dashboard.bae.eirb.fr',
      'https://dashboard.bae.eirb.fr/login',
    ])

    assert.lengthOf(origins, 1)
  })

  test('ignore une URL illisible plutôt que de la propager', ({ assert }) => {
    const origins = allowedOrigins(['pas-une-url', 'https://order.bae.eirb.fr'])

    assert.deepEqual(origins, ['https://order.bae.eirb.fr'])
  })
})
