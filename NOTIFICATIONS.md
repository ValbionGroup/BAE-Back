# Notifications et e-mails — exploitation

## Les deux tables

| Table             | Ce qu'elle porte                                                 |
| ----------------- | ---------------------------------------------------------------- |
| `activity_events` | Le **fait** métier : acteur, verbe, sujet, `payload`, horodatage |
| `notifications`   | Sa **livraison** à une personne, par canal (`mail` \| `in_app`)  |

`activity_events` est aussi la source du fil d'activité de l'accueil : le fil est le flux global,
la notification en est la projection vers une personne.

### Ce qui garantit qu'un rappel part une fois

```sql
UNIQUE (event_id, user_id, channel)   -- sur notifications
UNIQUE (dedupe_key)                   -- sur activity_events
```

La première empêche de **livrer** deux fois le même fait à la même personne ; la seconde empêche
d'**émettre** deux fois le même fait. Les deux sont nécessaires : sans `dedupe_key`, deux passages
d'une commande créeraient deux faits distincts, que la première contrainte ne verrait pas.

⚠️ **L'idempotence n'est pas dans le code applicatif, elle est dans la base.** Un
`if (déjà envoyé) return` lu puis écrit ne protège pas d'un cron qui se chevauche : entre la lecture
et l'écriture, un second processus lit la même absence. Ici c'est l'`INSERT` qui fait office de
verrou, et la violation d'unicité qui est rattrapée.

⚠️ Chaque insertion de livraison vit dans son propre **SAVEPOINT**. Sans lui, une violation
d'unicité avorterait la transaction entière (comportement Postgres) et les destinataires suivants
seraient silencieusement perdus.

⚠️ **`activity_events` n'a aucune clé étrangère vers `events`**, délibérément : une soirée annulée
ne doit pas effacer la trace qu'un rappel est parti, sinon le rappel repartirait. Conséquence à
connaître : supprimer une soirée **ne nettoie pas** ses faits ni ses notifications.

## Les trois commandes

Adonis n'a pas d'ordonnanceur : la récurrence vient du cron système.

| Commande                   | Rôle                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `notify:presence-pending`  | Met en file un rappel pour les membres **sans réponse**          |
| `notify:presence-upcoming` | Met en file un rappel pour les membres ayant répondu **présent** |
| `notify:dispatch`          | Vide la file : envoie et horodate                                |

Les deux détecteurs acceptent `--days=n` (fenêtre avant la soirée, défaut 3) et `--dry-run`.
`notify:dispatch` accepte `--dry-run`.

**Détection et envoi sont séparés à dessein** : un SMTP indisponible ne fait pas perdre la
détection, et chaque moitié se teste sans l'autre.

```cron
# Rappels BAE — l'application ne planifie rien elle-même.
0 10 * * *   cd /srv/bae-back && node ace notify:presence-pending
0 18 * * *   cd /srv/bae-back && node ace notify:presence-upcoming
*/15 * * * * cd /srv/bae-back && node ace notify:dispatch
```

## L'envoi

```
MAIL_MAILER=log|smtp      # défaut : log
MAIL_FROM_NAME=BAE
MAIL_FROM_ADDRESS=no-reply@bae.eirb.fr
SMTP_HOST=...             # optionnelles : requises seulement si MAIL_MAILER=smtp
SMTP_PORT=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
```

⚠️ **`MAIL_MAILER=log` avale les messages** en les journalisant, sans rien signaler d'anormal.
C'est le défaut parce qu'aucun SMTP n'est encore fourni et que l'application doit démarrer sans.
**Basculer sur `smtp` en production** dès que les identifiants existent — c'est la seule chose à
faire, aucun code ne change.

Les variables SMTP sont volontairement **optionnelles** dans `start/env.ts` : les rendre requises
empêcherait le démarrage en développement.

## Vérifier la chaîne à la main

```bash
node ace notify:presence-pending --dry-run   # annonce sans écrire
node ace notify:presence-pending             # « N mise(s) en file »
node ace notify:presence-pending             # « 0 mise(s) en file, N déjà connue(s) »  ← l'idempotence
node ace notify:dispatch                     # « N envoyée(s) »
node ace notify:dispatch                     # « Aucune notification en attente. »      ← la preuve
```

Les deux secondes exécutions sont la vérification qui compte : si elles renvoient autre chose, la
protection contre le double envoi est cassée.

## Piège de test

**`EventFactory` tire `status` au hasard** parmi `scheduled | ongoing | completed`. Tout test qui
dépend du statut doit le fixer explicitement — sinon il réussit deux fois sur trois, et un test
d'absence réussit pour la mauvaise raison.
