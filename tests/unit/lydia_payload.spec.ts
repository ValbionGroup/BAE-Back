import { test } from '@japa/runner'
import { buildDoBody, parseDoResponse, parseStateResponse } from '#services/lydia/lydia_payload'

const INPUT = {
  recipient: 'camille@test.fr',
  amountCents: 350,
  orderRef: 'ref-1',
  message: 'Précommande BAE',
  expireTimeSeconds: 900,
  confirmUrl: 'https://api.test/v1/lydia/callback/ref-1',
  browserSuccessUrl: 'https://order.test/paiement/ref-1',
  browserFailUrl: 'https://order.test/paiement/ref-1',
}

/**
 * Ces tests gardent la frontière avec Lydia : **tout ce qui traverse est écrit
 * dans leur vocabulaire, pas dans le nôtre**. Les deux moitiés du problème — le
 * montant en euros et les noms de champs — se cassent silencieusement, sans
 * qu'aucune erreur ne remonte de leur côté.
 */
test.group('Charge utile Lydia', () => {
  /**
   * Le défaut visé : envoyer des centimes dans un champ qui attend des euros.
   * 350 factureraient 350 € au lieu de 3,50 €.
   */
  test('le montant part en euros à deux décimales', ({ assert }) => {
    assert.equal(buildDoBody(INPUT, 'vendor-abc').get('amount'), '3.50')
    assert.equal(buildDoBody({ ...INPUT, amountCents: 1500 }, 'v').get('amount'), '15.00')
    assert.equal(buildDoBody({ ...INPUT, amountCents: 7 }, 'v').get('amount'), '0.07')
  })

  /**
   * Le défaut visé : faire dériver les noms de champs d'une convention BAE. Ce
   * sont ceux de Lydia, et un renommage local les casserait sans bruit.
   */
  test('les clés sont celles de Lydia, en snake_case', ({ assert }) => {
    const body = buildDoBody(INPUT, 'vendor-abc')

    assert.equal(body.get('vendor_token'), 'vendor-abc')
    assert.equal(body.get('type'), 'email')
    assert.equal(body.get('recipient'), 'camille@test.fr')
    assert.equal(body.get('order_ref'), 'ref-1')
    assert.equal(body.get('expire_time'), '900')
    assert.equal(body.get('confirm_url'), INPUT.confirmUrl)
    assert.equal(body.get('browser_success_url'), INPUT.browserSuccessUrl)
    assert.equal(body.get('currency'), 'EUR')
  })

  /**
   * Le défaut visé : Lydia répond 200 avec `error` non nul. Traiter ça comme un
   * succès laisserait un paiement sans `mobile_url`, donc impayable.
   */
  test('une réponse en erreur lève plutôt que de rendre un résultat vide', ({ assert }) => {
    assert.throws(() => parseDoResponse({ error: '3', message: 'invalid recipient' }))
  })

  test('une réponse valide rend les trois champs utiles', ({ assert }) => {
    const result = parseDoResponse({
      error: 0,
      request_id: 42,
      request_uuid: 'uuid-1',
      mobile_url: 'https://lydia-app.com/pay/uuid-1',
    })

    assert.deepEqual(result, {
      requestUuid: 'uuid-1',
      requestId: '42',
      mobileUrl: 'https://lydia-app.com/pay/uuid-1',
    })
  })

  /**
   * Le défaut visé : `state` arrive en chaîne. Comparé à `1` avec `===`, un
   * paiement confirmé ne le serait jamais.
   */
  test('l’état est rendu en nombre, quelle que soit sa forme reçue', ({ assert }) => {
    assert.equal(parseStateResponse({ state: '1' }).state, 1)
    assert.equal(parseStateResponse({ state: 6 }).state, 6)
    assert.equal(parseStateResponse({}).state, -1)
  })

  /**
   * Le défaut visé : conclure « montant manipulé » sur une absence de montant.
   * Lydia ne documente pas ce champ ; `null` doit dire « inconnu », pas « zéro ».
   */
  test('un montant absent de la réponse d’état vaut inconnu, pas zéro', ({ assert }) => {
    assert.isNull(parseStateResponse({ state: 1 }).amountCents)
    assert.equal(parseStateResponse({ state: 1, amount: '3.50' }).amountCents, 350)
  })
})
