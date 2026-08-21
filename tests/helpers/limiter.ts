import limiter from '@adonisjs/limiter/services/main'

/**
 * ⚠️ À appeler dans le `group.each.setup()` de toute spec qui touche une route
 * limitée. Les compteurs vivent dans le magasin, pas dans la base : la
 * transaction globale des tests ne les annule donc **pas**, et ils survivent d'un
 * test au suivant.
 *
 * Sans cela la suite devient dépendante de l'ordre — un test reçoit un 429 parce
 * que ses prédécesseurs ont épuisé le budget de son adresse IP, et l'échec
 * n'apparaît qu'en suite complète.
 */
export function clearLimits(): Promise<void> {
  return limiter.clear()
}
