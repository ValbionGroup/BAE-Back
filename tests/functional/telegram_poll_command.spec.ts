import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import TelegramClient from '#services/telegram/telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'
import { issueLinkCode } from '#services/telegram/telegram_link_service'
import TelegramPoll from '../../commands/telegram_poll.js'

const CHAT_ID = 987654321

/**
 * Le **même** JSON que celui du test du webhook : c'est ce qui démontre que les
 * deux transports passent par `handleUpdate` sans rien préparer chacun de leur côté.
 */
function startUpdate(code: string) {
  return {
    update_id: 99,
    message: {
      message_id: 3,
      chat: { id: CHAT_ID, type: 'private' },
      from: { id: CHAT_ID, is_bot: false, first_name: 'Léa', username: 'lea_m' },
      text: `/start ${code}`,
    },
  }
}

test.group('telegram:poll', (group) => {
  let telegram: FakeTelegramClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })
  group.each.setup(() => {
    telegram = new FakeTelegramClient()
    app.container.swap(TelegramClient, () => telegram)
    return () => app.container.restore(TelegramClient)
  })

  test('lie le compte par le même chemin que le webhook', async ({ assert }) => {
    const user = await UserFactory.create()
    const { code } = await issueLinkCode(user.id)
    telegram.pending = [{ updateId: 99, raw: startUpdate(code) }]

    const command = await ace.create(TelegramPoll, ['--once'])
    await command.exec()
    command.assertSucceeded()

    await user.refresh()
    assert.equal(String(user.telegramChatId), String(CHAT_ID))
    assert.include(telegram.sent[0]?.text, 'C’est fait')
  })

  test('un tour à vide ne fait rien', async ({ assert }) => {
    const command = await ace.create(TelegramPoll, ['--once'])
    await command.exec()
    command.assertSucceeded()

    assert.lengthOf(telegram.sent, 0)
  })
})
