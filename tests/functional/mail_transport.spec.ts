import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { PresenceReminderNotification } from '#mails/presence_reminder_notification'

/**
 * ⚠️ Le faux mailer range dans **deux collections distinctes** : `mails` quand on
 * envoie une instance de `BaseMail`, `messages` quand on envoie un callback.
 * Chercher un envoi d'instance dans `messages` rend toujours une liste vide, sans
 * lever d'erreur — un test écrit à l'envers passerait donc à tort.
 */
test.group('Transport mail', () => {
  test('un rappel porte son destinataire, son sujet et son corps', async ({ assert }) => {
    const fake = mail.fake()

    await mail.send(
      new PresenceReminderNotification('membre@bae.test', 'Réponds pour la soirée', [
        'La soirée Gala a lieu le 1er septembre.',
      ])
    )

    fake.mails.assertSent(PresenceReminderNotification)

    const sent = fake.mails.sent()
    assert.lengthOf(sent, 1)

    const payload = sent[0].message.toJSON().message
    assert.deepEqual(payload.to, ['membre@bae.test'])
    assert.equal(payload.subject, 'Réponds pour la soirée')
    assert.include(String(payload.text), 'Gala')

    mail.restore()
  })

  test('l’expéditeur vient de la configuration, pas du gabarit', async ({ assert }) => {
    const fake = mail.fake()

    await mail.send(new PresenceReminderNotification('membre@bae.test', 'Sujet', ['Corps']))

    const payload = fake.mails.sent()[0].message.toJSON().message
    assert.isDefined(payload.from, 'le bloc `from` de config/mail.ts doit s’appliquer')

    mail.restore()
  })
})
