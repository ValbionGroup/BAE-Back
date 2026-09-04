# Notifications et e-mails — exploitation

## Les deux tables

| Table             | Ce qu'elle porte                                                              |
| ----------------- | ----------------------------------------------------------------------------- |
| `activity_events` | Le **fait** métier : acteur, verbe, sujet, `payload`, horodatage              |
| `notifications`   | Sa **livraison** à une personne, par canal (`mail` \| `in_app` \| `telegram`) |

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
| `notify:presence-tomorrow` | Met en file, la veille, un rappel **portant le poste** de chacun |
| `notify:dispatch`          | Vide la file du canal `mail` : envoie et horodate                |
| `telegram:dispatch`        | Vide la file du canal `telegram`                                 |

Les deux détecteurs acceptent `--days=n` (fenêtre avant la soirée, défaut 3) et `--dry-run`.
`notify:dispatch` accepte `--dry-run`.

**Détection et envoi sont séparés à dessein** : un SMTP indisponible ne fait pas perdre la
détection, et chaque moitié se teste sans l'autre.

```cron
# Rappels BAE — l'application ne planifie rien elle-même.
0 10 * * *   cd /srv/bae-back && node ace notify:presence-pending
0 18 * * *   cd /srv/bae-back && node ace notify:presence-upcoming
0 19 * * *   cd /srv/bae-back && node ace notify:presence-tomorrow
*/15 * * * * cd /srv/bae-back && node ace notify:dispatch
* * * * *    cd /srv/bae-back && node ace telegram:dispatch
```

19 h et non 18 h : deux détecteurs démarrés à la même minute se disputeraient les mêmes soirées.
L'idempotence les départagerait correctement, mais l'un des deux journaliserait un résultat
trompeur.

⚠️ `notify:presence-tomorrow` porte une fenêtre par défaut de **1 jour**, les deux autres de 3.
« 24 h » veut donc dire « dans les prochaines 24 heures au passage du cron », pas « exactement 24 h
avant » : une soirée à 22 h est prévenue la veille à 19 h, soit 27 h avant. Un rappel à l'heure près
demanderait un cron horaire et une fenêtre glissante.

## Telegram

N'importe quel compte lie le sien depuis « Mon profil » — la page publique comme les paramètres du
dashboard : le site émet un code à usage unique (15 minutes), l'emmène sur `t.me/<bot>?start=<code>`,
et le bot enregistre son `chat_id`. `/stop` délie depuis la conversation.

La liaison est portée par **`users`**, et non `clients` : la plupart des notifications s'adressent
au bureau, dont les membres n'ont pas forcément de ligne `clients`.

Le canal `telegram` est un **miroir de `mail`** : `emit()` l'ajoute pour tout destinataire dont le
compte est lié, sans qu'aucun émetteur ait à le demander. Un envoi purement `in_app` ne part pas
dans Telegram — ce serait transformer le fil d'activité en messages poussés.

`telegram:dispatch` a sa propre commande parce que `notify:dispatch` laisse volontairement une
panne SMTP avorter le passage : ici, un destinataire qui a bloqué le bot ne doit pas priver les
autres. Un refus définitif de Telegram (403, chat introuvable) **délie le compte** et horodate
quand même la ligne — sinon la file la retenterait indéfiniment. Sur ce chemin, `sent_at` veut dire
« la file en a fini », pas « reçu ».

### Mise en service

```
node ace telegram:webhook            # enregistre le webhook et son secret
node ace telegram:webhook --delete   # le retire
```

⚠️ **Telegram refuse `getUpdates` tant qu'un webhook est enregistré.** En développement, utilisez
un second bot BotFather et `node ace telegram:poll`, qui fait passer les mises à jour par le même
code que le webhook.

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

**`EventFactory` déduit `status` de la date**, et sa date est toujours future : une soirée
fabriquée est donc `scheduled`. Un test qui dépend d'un autre statut doit fixer **la date et le
statut**.

(Le tirage aléatoire décrit ici auparavant a été supprimé — cf. `database/factories/event_factory.ts`,
qui explique les deux bugs de dev qu'il a coûtés.)
