import db from '@adonisjs/lucid/services/db'
import Ticket from '#models/ticket'
import type { TicketStatus } from '#models/ticket'
import TicketMessage from '#models/ticket_message'
import { emit, recordEvent } from '#services/notification_service'

/**
 * Les destinataires d'un ticket ouvert : toute personne autorisée à les lire —
 * le « pôle web » du cahier des charges. Dérivé des permissions plutôt que d'une
 * liste d'adresses, pour qu'un changement de rôle suffise à changer qui reçoit.
 */
async function supportRecipients(): Promise<number[]> {
  const rows = await db
    .from('members')
    .join('roles_permissions', 'roles_permissions.role_id', 'members.role_id')
    .where('roles_permissions.permission_id', 'ticket:read')
    .distinct('members.id')
    .select('members.id')

  return rows.map((row) => Number(row.id))
}

export async function openTicket(input: {
  authorId: number
  subject: string
  body: string
  priority?: 'low' | 'normal' | 'high'
}): Promise<Ticket> {
  const ticket = await db.transaction(async (trx) => {
    const created = await Ticket.create(
      {
        authorId: input.authorId,
        subject: input.subject,
        status: 'open',
        priority: input.priority ?? 'normal',
      },
      { client: trx }
    )

    await TicketMessage.create(
      { ticketId: created.id, authorId: input.authorId, body: input.body },
      { client: trx }
    )

    return created
  })

  // Émis **hors** de la transaction : un incident de notification ne doit pas
  // annuler l'ouverture du ticket. Perdre l'alerte est ennuyeux, perdre la
  // demande de l'utilisateur l'est bien davantage.
  const recipients = await supportRecipients()

  const fact = {
    verb: 'ticket.opened',
    actorId: input.authorId,
    subjectType: 'ticket',
    subjectId: ticket.id,
    payload: {
      subject: 'Nouveau ticket',
      lines: [ticket.subject],
      what: 'a ouvert le ticket',
      emphasis: ticket.subject,
    },
    dedupeKey: `ticket.opened:${ticket.id}`,
  } as const

  // ⚠️ Le fait est enregistré **même sans destinataire**. Le lier à l'existence
  // d'un lecteur ferait disparaître l'ouverture du fil d'activité le jour où
  // personne ne porte `ticket:read` — l'action a eu lieu, qu'on la notifie ou
  // non. C'est toute la raison d'être de `recordEvent` à côté d'`emit`.
  if (recipients.length > 0) {
    await emit({ ...fact, recipients, channels: ['in_app', 'mail'] })
  } else {
    await recordEvent(fact)
  }

  return ticket
}

export async function changeStatus(ticket: Ticket, next: TicketStatus): Promise<Ticket> {
  if (ticket.status === next) return ticket

  ticket.status = next
  await ticket.save()

  // Vers l'auteur, et lui seul : c'est lui qui attend la réponse.
  //
  // ⚠️ **Aucun `dedupeKey` ici, délibérément.** Le dédoublonnage protège d'une
  // *détection* répétée — un cron qui repasse sur la même situation. Un
  // changement de statut est une *action humaine*, et un aller-retour
  // `en cours → clos → en cours` doit notifier à chaque fois. Y mettre une clé
  // horodatée serait pire que rien : l'apparence du dédoublonnage sans l'effet.
  await emit({
    verb: 'ticket.updated',
    subjectType: 'ticket',
    subjectId: ticket.id,
    payload: {
      subject: 'Ticket mis à jour',
      lines: [`« ${ticket.subject} » est passé en ${STATUS_LABEL[next]}.`],
      status: next,
    },
    recipients: [ticket.authorId],
    channels: ['in_app', 'mail'],
  })

  return ticket
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'ouvert',
  in_progress: 'en cours de traitement',
  closed: 'clos',
}
