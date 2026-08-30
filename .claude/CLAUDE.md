## Commentaires

- **Pas de commentaire inline.** Aucun `//` dans un corps de fonction, ni au-dessus d'une
  ligne, ni en fin de ligne. Ce qui mérite d'être dit remonte dans une docstring `/** */`.
- **Docstrings courtes.** Une ou deux lignes. Un paragraphe est déjà trop long.
- Un commentaire ne se garde que pour une contrainte venue d'ailleurs : une unité
  (centimes), un piège du framework, une règle imposée par le SSO. Jamais pour redire la
  signature ni narrer le chemin nominal.
- **Les fichiers `start/routes/*.ts` restent nus.**
- Un commentaire retiré par le user est un retrait délibéré : ne pas le réécrire.

## Fichiers auto-générés — ne jamais éditer

- `database/schema.ts` — régénéré par `node ace migration:run`.
- `.adonisjs/server/controllers.ts` — régénéré par `node ace make:controller`.

## Pièges

- `router.put(path, …)` et `router.patch(path, …)` déclarés séparément sur la même action
  font planter le boot. Utiliser `router.route(path, ['PUT', 'PATCH'], [ctrl, 'action'])`.
- Les colonnes `decimal` et `bigint` reviennent en **string** du driver `pg`.
- Les `DateTime` Luxon se sérialisent avec `.toISO()` / `.toISODate()`, jamais bruts.
- Tout montant est un entier de **centimes**, en base comme dans l'API.

## Tests

`node ace test`. Le conteneur `bae-postgres-dev` (port **5433**) doit tourner avant.
