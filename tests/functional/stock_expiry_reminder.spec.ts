import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import { DateTime } from 'luxon'
import ActivityEvent from '#models/activity_event'
import Notification from '#models/notification'
import { GoodFactory } from '#database/factories/good_factory'
import { StockBatchFactory } from '#database/factories/stock_batch_factory'
import { StockMovementFactory } from '#database/factories/stock_movement_factory'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import NotifyStockExpiring from '../../commands/notify_stock_expiring.js'
import { queueStockExpiryReminder } from '#services/stock_expiry_service'

/**
 * ⚠️ La base de dev est partagée et peuplée : le récapitulatif est **global**,
 * donc il contiendra toujours des lots qui ne viennent pas d'ici. Aucune
 * assertion ne porte sur un compte — chaque test cherche (ou refuse) le nom de
 * SA denrée dans les lignes du message.
 */
test.group('notify:stock-expiring', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  /** Un nom que le jeu de données de dev ne peut pas porter. */
  function uniqueName(suffix: string): string {
    return `ZZTEST-${suffix}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Une denrée et son lot unique. `remaining` permet de vider le lot par un
   * mouvement `out`, ce qui est la seule façon de le rendre vide : la quantité
   * restante n'est jamais stockée.
   */
  async function goodWithBatch(options: {
    name: string
    expiresIn: number
    quantity?: number
    consumed?: number
  }) {
    const good = await GoodFactory.merge({ name: options.name, unit: 'pcs' }).create()
    const quantity = options.quantity ?? 10
    const batch = await StockBatchFactory.merge({
      goodId: good.id,
      quantity: String(quantity),
      restockId: null,
      expirationDate: DateTime.now().plus({ days: options.expiresIn }),
    }).create()

    if (options.consumed !== undefined && options.consumed > 0) {
      await StockMovementFactory.merge({
        goodId: good.id,
        stockBatchId: batch.id,
        quantity: String(options.consumed),
        movementType: 'out',
      }).create()
    }

    return { good, batch }
  }

  async function run(args: string[] = []): Promise<void> {
    const command = await ace.create(NotifyStockExpiring, args)
    await command.exec()
    command.assertSucceeded()
  }

  /** Le fait du jour, s'il a été produit. */
  async function digest(): Promise<ActivityEvent | null> {
    return ActivityEvent.query()
      .where('verb', 'stock.expiring')
      .where('dedupeKey', `stock.expiring:${DateTime.now().toISODate()}`)
      .first()
  }

  async function digestLines(): Promise<string[]> {
    const fact = await digest()
    if (fact === null) return []
    return (fact.payload?.lines ?? []) as string[]
  }

  test('retient un lot dont la DLC tombe dans la fenêtre', async ({ assert }) => {
    const name = uniqueName('SOON')
    await goodWithBatch({ name, expiresIn: 3 })

    await run()
    const lines = await digestLines()

    assert.isTrue(lines.some((line) => line.includes(name)))
  })

  test('ignore un lot dont la DLC est au-delà de la fenêtre', async ({ assert }) => {
    const far = uniqueName('FAR')
    const witness = uniqueName('WITNESS')
    await goodWithBatch({ name: far, expiresIn: 40 })
    await goodWithBatch({ name: witness, expiresIn: 2 })

    await run()
    const lines = await digestLines()

    // Le témoin d'abord : sans lui, l'absence de `far` prouverait seulement que
    // le récapitulatif n'a pas été produit.
    assert.isTrue(lines.some((line) => line.includes(witness)))
    assert.isFalse(lines.some((line) => line.includes(far)))
  })

  // Un lot déjà périmé est le cas le plus urgent : l'exclure de la fenêtre
  // reviendrait à ne prévenir que de ce qui n'est pas encore un problème.
  test('inclut un lot déjà périmé', async ({ assert }) => {
    const name = uniqueName('DEAD')
    await goodWithBatch({ name, expiresIn: -5 })

    await run()
    const lines = await digestLines()

    const line = lines.find((entry) => entry.includes(name))
    assert.isDefined(line)
    assert.include(line!, 'périmé')
  })

  /**
   * ⚠️ Le test qui compte. Un lot entièrement consommé ne périme pas : prévenir
   * pour lui enverrait l'équipe chercher dans le frigo quelque chose qui n'y est
   * plus, et discréditerait tout le rappel.
   */
  test('ignore un lot vidé par ses mouvements', async ({ assert }) => {
    const empty = uniqueName('EMPTY')
    const witness = uniqueName('WITNESS')
    await goodWithBatch({ name: empty, expiresIn: 2, quantity: 8, consumed: 8 })
    await goodWithBatch({ name: witness, expiresIn: 2 })

    await run()
    const lines = await digestLines()

    assert.isTrue(lines.some((line) => line.includes(witness)))
    assert.isFalse(lines.some((line) => line.includes(empty)))
  })

  test('--days resserre ou élargit la fenêtre', async ({ assert }) => {
    const name = uniqueName('WINDOW')
    await goodWithBatch({ name, expiresIn: 20 })

    await run(['--days=30'])
    const lines = await digestLines()

    assert.isTrue(lines.some((line) => line.includes(name)))
  })

  test('--dry-run n’écrit aucun fait', async ({ assert }) => {
    const name = uniqueName('DRY')
    await goodWithBatch({ name, expiresIn: 1 })

    await run(['--dry-run'])

    assert.isNull(await digest())
  })

  /** Un cron qui se chevauche, ou une reprise après incident, ne doit pas
   *  produire un second récapitulatif le même jour. */
  test('deux exécutions le même jour ne produisent qu’un fait', async ({ assert }) => {
    await goodWithBatch({ name: uniqueName('DEDUPE'), expiresIn: 2 })

    await run()
    await run()

    const facts = await ActivityEvent.query()
      .where('verb', 'stock.expiring')
      .where('dedupeKey', `stock.expiring:${DateTime.now().toISODate()}`)

    assert.lengthOf(facts, 1)
  })

  test('livre le récapitulatif à qui porte stock:read', async ({ assert }) => {
    const member = await MemberFactory.create()
    await grantPermissions(member, ['stock:read'])
    await goodWithBatch({ name: uniqueName('TARGET'), expiresIn: 2 })

    await run()

    const fact = await digest()
    assert.isNotNull(fact)
    const rows = await Notification.query().where('eventId', fact!.id).where('userId', member.id)
    assert.isAbove(rows.length, 0)
  })

  /** Sans SMTP, `mail` dort en file : c'est `in_app` qui rend le rappel
   *  utilisable aujourd'hui. Les deux canaux partent donc. */
  test('emprunte les canaux in_app et mail', async ({ assert }) => {
    const member = await MemberFactory.create()
    await grantPermissions(member, ['stock:read'])
    await goodWithBatch({ name: uniqueName('CHAN'), expiresIn: 2 })

    await run()

    const fact = await digest()
    const rows = await Notification.query().where('eventId', fact!.id).where('userId', member.id)
    assert.sameMembers(
      rows.map((row) => row.channel),
      ['in_app', 'mail']
    )
  })

  /**
   * ⚠️ Interroge le service, pas la commande : sur la base de dev partagée des
   * lots **déjà périmés** existent, et ils entrent toujours dans le récap quelle
   * que soit la fenêtre. Se placer en l'an 2000 est le seul « rien à signaler »
   * déterministe — aucune DLC n'y est passée, et aucune n'y est proche.
   */
  test('ne produit rien quand aucun lot n’approche de sa DLC', async ({ assert }) => {
    await goodWithBatch({ name: uniqueName('QUIET'), expiresIn: 400 })

    const report = await queueStockExpiryReminder(7, {}, DateTime.fromISO('2000-01-01T00:00:00'))

    assert.equal(report.candidates, 0)
    assert.equal(report.created, 0)
  })
})
