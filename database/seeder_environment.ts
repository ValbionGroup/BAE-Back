/**
 * Les environnements où les données de démonstration ont le droit d'exister.
 *
 * `db:seed` n'a pas de garde `--force`, contrairement à `migration:run` : le
 * seul rempart devant une base de production est ce `static environment`, que le
 * runner d'Adonis lit avant d'instancier le seeder. Un commentaire ne
 * protégerait rien.
 *
 * ⚠️ « test » et non « testing » : Adonis normalise `NODE_ENV` avant de
 * comparer, et une valeur non normalisée n'égale jamais `app.nodeEnvironment`.
 *
 * ⚠️ Ce fichier vit hors de `database/seeders/` à dessein : le runner exécute
 * tout module de ce répertoire et échouerait ici sur l'absence d'export par
 * défaut.
 */
export const DEMO_ONLY = ['development', 'test']
