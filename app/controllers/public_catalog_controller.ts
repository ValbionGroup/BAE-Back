import type { HttpContext } from '@adonisjs/core/http'
import { listFastPasses, listOpenEvents, menuFor } from '#services/public_catalog_service'

/**
 * Le seul contrôleur **sans `middleware.auth()`** de l'application.
 *
 * C'est délibéré : la page d'accueil de la zone commandes doit se lire
 * déconnecté, sinon plus personne ne découvre ce que le BAE propose. La
 * contrepartie est stricte — rien de nominatif ne transite par ici.
 */
export default class PublicCatalogController {
  async events({ serialize }: HttpContext) {
    return serialize(await listOpenEvents())
  }

  async menu({ params, serialize }: HttpContext) {
    return serialize(await menuFor(Number(params.id)))
  }

  async fastPasses({ serialize }: HttpContext) {
    return serialize(await listFastPasses())
  }
}
