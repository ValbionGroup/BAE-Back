# Conventions d'API

## Enveloppe `data` des réponses

Toute réponse qui renvoie du **contenu** est enveloppée dans une clé `data` :

```jsonc
// GET /v1/categories  → collection
{ "data": [ { "id": 1, "name": "…" } ] }

// GET /v1/categories/1  → ressource unique
{ "data": { "id": 1, "name": "…" } }
```

Côté client, il faut donc toujours lire `response.data`.

### Comment l'appliquer

Dans un contrôleur, faire passer le contenu par `ctx.serialize()` :

```ts
async index({ serialize }: HttpContext) {
  return serialize(await Category.query())      // → { data: [...] }
}

async show({ params, serialize }: HttpContext) {
  return serialize(await Category.findOrFail(params.id))  // → { data: {...} }
}
```

`serialize()` (défini dans `providers/api_provider.ts`) normalise l'entrée avant
d'envelopper :

| Entrée                               | Résultat                                  |
| ------------------------------------ | ----------------------------------------- |
| modèle Lucid                         | `{ data: {…} }` (via `model.serialize()`) |
| tableau (de modèles ou d'objets)     | `{ data: [...] }`                         |
| objet simple / sortie de transformer | `{ data: {…} }`                           |
| paginator Lucid                      | `{ data: [...], metadata: {…} }`          |

### Exceptions

- **Primitives** (`number`, `string`, `boolean`) : `serialize()` ne les enveloppe
  pas. Retourner un littéral explicite, p. ex. `return { data: status }`.
- **Réponses sans contenu** (`store`/`update` peuvent renvoyer la ressource ;
  `destroy` renvoie `response.noContent()` / `204`).

### Conversion de casse

Le `case_converter_middleware` convertit ensuite les clés en `snake_case` dans la
réponse (et en `camelCase` les entrées). L'enveloppe `data` est appliquée **avant**
cette conversion.
