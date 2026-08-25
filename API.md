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

## Unité monétaire

**Tout montant est un `integer` de centimes**, sans exception : en base, dans les corps de
requête et dans les réponses. Aucune valeur monétaire ne transite en euros ni en décimal.

Champs passés de euros à centimes le 2026-08-25 :

| Endpoint | Champ |
| --- | --- |
| `GET /transactions` | `amount` |
| `GET /subscriptions`, `GET /me` | `subscriptions[].amount` |
| `GET /events/:id/summary` | `cashed_by_method[].amount` |
| `GET /events/:id/products` | `unit_cost`, `total_cost` |
| `GET /products/summary` | `cost` |
| `GET /vouchers` | `value` |
| `GET /furnitures` | `price` |
| `GET /fast-passes` | `price` |
| `GET /restocks` | `total_price` |
| `GET /events/:id/shopping-list` | `best_price`, `supplier_totals[].total`, `totals.*` |

`GET /v1/public/fast-passes` est inchangé : il exposait déjà `price_cents`. Le suffixe ne
distingue plus rien, mais il fait partie du contrat public depuis le 2026-08-17.

⚠️ `transactions.amount` et `payments.amount_cents` portent tous deux des centimes sous deux
noms différents. **Le suffixe ne signale rien** : c'est l'absence de décimale qui est la règle.

⚠️ Les valeurs **dérivées** (`unit_cost`, `total_cost`, `cost`, les totaux de la liste de
courses) sont arrondies à l'émission. Elles naissent d'un prix en centimes multiplié par une
quantité de recette fractionnaire (`product_goods.quantity` est un `decimal(10,4)`), donc leur
somme exacte ne tombe pas juste. L'arrondi a lieu le plus tard possible : un total n'est jamais
dérivé d'un unitaire déjà arrondi.

Restent décimales, et le resteront : les **quantités** — `stock_batches.quantity`,
`stock_movements.quantity`, `product_goods.quantity`.

Les conversions vers **euros** qui subsistent sont des frontières externes, pas internes :
`lydia_payload.ts` convertit parce que l'API Lydia attend des euros. SumUp reçoit déjà des
centimes (`minor_unit: 2`).
