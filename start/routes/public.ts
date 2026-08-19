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
