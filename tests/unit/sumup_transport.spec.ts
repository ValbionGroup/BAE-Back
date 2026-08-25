import { test } from '@japa/runner'
import { toReader } from '#services/sumup/http_sumup_client'

/**
 * Ces tests gardent la lecture d'un lecteur SumUp — la seule chose que
 * `sumup:readers` affiche, et donc la seule source de `SUMUP_READER_ID`.
 *
 * Une clé mal lue ne lève rien : elle rend une ligne vide dans un tableau, et
 * la variable d'environnement recopiée depuis cette ligne allume le mauvais
 * terminal, ou aucun.
 */
test.group('Lecture d’un lecteur SumUp', () => {
  /** Le défaut visé : chercher le numéro de série à la racine de l'objet. */
  test('l’appareil est lu dans l’objet imbriqué', ({ assert }) => {
    const reader = toReader({
      id: 'rdr_1',
      name: 'Caisse BAE',
      status: 'paired',
      device: { identifier: 'SOLO-42', model: 'solo' },
    })

    assert.deepEqual(reader, {
      id: 'rdr_1',
      name: 'Caisse BAE',
      status: 'paired',
      deviceIdentifier: 'SOLO-42',
    })
  })

  /**
   * Le défaut visé : planter sur un lecteur sans bloc `device`. La commande
   * doit pouvoir lister un lecteur en cours d'appairage, pas s'interrompre.
   */
  test('un lecteur sans appareil reste listable', ({ assert }) => {
    const reader = toReader({ id: 'rdr_2', name: 'En cours', status: 'processing' })

    assert.equal(reader.id, 'rdr_2')
    assert.isNull(reader.deviceIdentifier)
  })

  /**
   * Le défaut visé : présenter un statut absent comme `paired`. Un lecteur dont
   * on ignore l'état ne doit surtout pas passer pour utilisable.
   */
  test('un statut absent vaut inconnu, jamais appairé', ({ assert }) => {
    assert.equal(toReader({ id: 'rdr_3' }).status, 'unknown')
    assert.equal(toReader(null).status, 'unknown')
  })
})
