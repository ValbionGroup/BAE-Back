import { test } from '@japa/runner'
import {
  buildCheckoutBody,
  parseCheckoutResponse,
  parseTransactionResponse,
} from '#services/sumup/sumup_payload'

const INPUT = {
  amountCents: 350,
  description: 'BAE — commande comptoir',
  returnUrl: 'https://api.test/v1/sumup/callback/ref-1',
}

/**
 * Ces tests gardent la frontière avec SumUp, où **deux unités cohabitent** :
 * le checkout part en unités mineures, la relecture de transaction revient en
 * euros. Confondre les deux ne lève aucune erreur — ça facture cent fois trop,
 * ou compare un montant à un centième de lui-même.
 */
test.group('Charge utile SumUp', () => {
  /**
   * Le défaut visé : convertir en euros par réflexe, comme pour Lydia. 3,50
   * partirait dans un champ qui attend 350, et le TPE demanderait 0,03 €.
   */
  test('le montant part en unités mineures, pas en euros', ({ assert }) => {
    assert.deepEqual(buildCheckoutBody(INPUT).total_amount, {
      currency: 'EUR',
      minor_unit: 2,
      value: 350,
    })

    assert.equal(buildCheckoutBody({ ...INPUT, amountCents: 1500 }).total_amount.value, 1500)
    assert.equal(buildCheckoutBody({ ...INPUT, amountCents: 7 }).total_amount.value, 7)
  })

  /**
   * Le défaut visé : nommer les clés selon la convention BAE. Ce sont celles de
   * SumUp, et le convertisseur de casse du projet ne s'applique pas ici.
   */
  test('les clés sont celles de SumUp', ({ assert }) => {
    const body = buildCheckoutBody(INPUT)

    assert.equal(body.return_url, INPUT.returnUrl)
    assert.equal(body.description, INPUT.description)
  })

  /**
   * Le défaut visé : garder le `checkout_id` et jeter le `client_transaction_id`.
   * C'est ce dernier, et lui seul, qui permet de relire l'état plus tard.
   */
  test('la réponse de checkout rend les deux identifiants', ({ assert }) => {
    const result = parseCheckoutResponse({
      data: {
        checkout_id: 'chk-1',
        client_transaction_id: 'ctx-1',
      },
    })

    assert.deepEqual(result, { checkoutId: 'chk-1', clientTransactionId: 'ctx-1' })
  })

  /**
   * Le défaut visé : accepter un 200 sans identifiant exploitable. Le paiement
   * serait alors lancé sur le TPE sans qu'on puisse jamais en lire l'issue.
   */
  test('une réponse sans identifiant de transaction lève', ({ assert }) => {
    assert.throws(() => parseCheckoutResponse({ data: { checkout_id: 'chk-1' } }))
    assert.throws(() => parseCheckoutResponse({}))
  })

  /**
   * Le défaut visé : comparer directement les libellés de SumUp ailleurs dans le
   * code. Ils sont en majuscules et ne sont pas les nôtres.
   */
  test('les statuts SumUp sont traduits dans notre vocabulaire', ({ assert }) => {
    assert.equal(parseTransactionResponse({ status: 'SUCCESSFUL' }).state, 'successful')
    assert.equal(parseTransactionResponse({ status: 'FAILED' }).state, 'failed')
    assert.equal(parseTransactionResponse({ status: 'CANCELLED' }).state, 'cancelled')
    assert.equal(parseTransactionResponse({ status: 'PENDING' }).state, 'pending')
    assert.equal(parseTransactionResponse({ status: 'REFUNDED' }).state, 'refunded')
  })

  /**
   * Le défaut visé : traiter un statut inconnu comme un succès. Un libellé
   * ajouté par SumUp écrirait alors une commande sans qu'aucun argent n'arrive.
   */
  test('un statut inconnu ou absent reste en attente, jamais en succès', ({ assert }) => {
    assert.equal(parseTransactionResponse({ status: 'SOMETHING_NEW' }).state, 'pending')
    assert.equal(parseTransactionResponse({}).state, 'pending')
  })

  /**
   * Le défaut visé, et le plus coûteux : lire `amount: 15.0` comme 15 centimes.
   * Le contrôle de montant conclurait à une divergence sur tout paiement réussi.
   */
  test('le montant relu arrive en euros et repart en centimes', ({ assert }) => {
    assert.equal(parseTransactionResponse({ status: 'SUCCESSFUL', amount: 15 }).amountCents, 1500)
    assert.equal(parseTransactionResponse({ status: 'SUCCESSFUL', amount: 3.5 }).amountCents, 350)
    assert.equal(
      parseTransactionResponse({ status: 'SUCCESSFUL', amount: '3.50' }).amountCents,
      350
    )
  })

  /**
   * Le défaut visé : conclure « montant manipulé » sur une absence de montant.
   * `null` doit dire « inconnu », pas « zéro ».
   */
  test('un montant absent vaut inconnu, pas zéro', ({ assert }) => {
    assert.isNull(parseTransactionResponse({ status: 'PENDING' }).amountCents)
  })

  test('le code de transaction est conservé quand il existe', ({ assert }) => {
    assert.equal(
      parseTransactionResponse({ status: 'SUCCESSFUL', transaction_code: 'TXCODE' })
        .transactionCode,
      'TXCODE'
    )
    assert.isNull(parseTransactionResponse({ status: 'SUCCESSFUL' }).transactionCode)
  })
})
