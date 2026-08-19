import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

/**
 * La zone commandes, ouverte sur Internet.
 *
 * ⚠️ **Aucun `middleware.auth()` sur ce groupe**, et c'est le seul du dépôt dans
 * ce cas. La page d'accueil publique doit se lire déconnecté ; en contrepartie,
 * `public_catalog_service` ne renvoie rien de nominatif. Ajouter ici une route
 * qui lit `auth` reviendrait à publier des données personnelles.
 */
router
  .group(() => {
    router.get('/events', [controllers.PublicCatalog, 'events'])
    router.get('/events/:id/menu', [controllers.PublicCatalog, 'menu'])
    router.get('/fast-passes', [controllers.PublicCatalog, 'fastPasses'])
  })
  .prefix('v1/public')
  .as('public_catalog')

/**
 * Sous `/account` et **sans garde d'audience** — même raison que les
 * notifications : ce sont ses achats, et un membre en a autant qu'un client.
 * Le contrôle d'accès est le `where user_id` du service.
 */
router
  .group(() => {
    router.get('/pre-orders', [controllers.AccountPurchases, 'preOrders'])
    router.get('/pre-orders/:id', [controllers.AccountPurchases, 'preOrder'])
    router.get('/pre-orders/:id/qr', [controllers.AccountPurchases, 'preOrderQr'])
    router.get('/subscriptions', [controllers.AccountPurchases, 'subscriptions'])

    /**
     * Les achats, eux, exigent `audience('client')` : la consultation ci-dessus
     * se protège toute seule par son `where user_id`, alors qu'engager une
     * dépense au nom de quelqu'un demande de prouver qu'il est bien de la zone
     * publique. `POST /v1/subscriptions` reste le geste du membre au local —
     * même objet, ni les mêmes droits ni le même paiement.
     */
    router
      .post('/subscriptions', [controllers.AccountPayments, 'subscribe'])
      .use(middleware.audience('client'))
  })
  .prefix('v1/account')
  .as('account_purchases')
  .use(middleware.auth())

/**
 * Le webhook de paiement. **Sans authentification, et c'est le seul moyen** :
 * un prestataire ne présente ni session ni jeton.
 *
 * Sa sûreté ne vient pas d'un secret mais de son comportement — la notification
 * n'est pas crue, l'état est réinterrogé auprès de Lydia. Un appel avec une
 * référence devinée ne déclenche donc qu'une lecture.
 *
 * ⚠️ Deux réflexes à ne pas avoir ici, malgré le §10.4 :
 * - **Ne pas l'ajouter à `csrf.exceptRoutes`** : `config/shield.ts` excepte déjà
 *   toute requête dépourvue de cookie de session, ce qu'est un appel de serveur
 *   à serveur.
 * - **Ne pas l'exclure du journal** : la mise en garde sur `logs.url` vise les
 *   jetons en query string. `orderRef` est dans le chemin, et n'est pas un
 *   secret — le connaître ne donne rien. La trace, elle, sert à diagnostiquer
 *   une notification qui n'arrive pas.
 */
router
  .group(() => {
    router.post('/callback/:orderRef', [controllers.LydiaCallbacks, 'notify'])
  })
  .prefix('v1/lydia')
  .as('lydia')
