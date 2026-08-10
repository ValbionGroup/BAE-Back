import type Product from '#models/product'

/**
 * La catégorie d'une recette, dérivée de son ingrédient principal.
 *
 * `products` n'a **pas** de colonne de catégorie — seules les denrées en ont
 * une. Une recette est donc étiquetée par la catégorie de son ingrédient de plus
 * bas `rank` dans le pivot `product_goods`, c'est-à-dire le même ordre que celui
 * dans lequel `ProductsController.ingredients` les renvoie : l'ordre
 * d'assemblage. Le premier ingrédient d'un hot-dog est le pain, donc la recette
 * est « Sec » ; celui d'une portion de frites est la frite, donc « Frais ».
 *
 * Départage par nom à rang égal, pour que la valeur soit **déterministe** : deux
 * ingrédients au même rang existent (rien ne l'interdit en base) et un tri
 * instable ferait changer la catégorie d'une recette d'une requête à l'autre.
 *
 * Renvoie `null` — jamais la chaîne vide — pour une recette sans ingrédient, ou
 * dont l'ingrédient principal n'est pas catégorisé : l'écran doit pouvoir
 * distinguer « pas de catégorie » d'une catégorie nommée.
 *
 * Le produit doit avoir été chargé avec
 * `preload('goods', (goods) => goods.preload('category'))`, sans quoi la
 * relation est absente et cette fonction renvoie `null` pour tout le monde.
 *
 * ⚠️ `ProductsController` porte encore sa propre copie de cette dérivation
 * (`primaryCategoryName`, module-privée) et devrait consommer celle-ci. Elle n'a
 * pas été migrée parce que ce fichier était en cours de modification par un
 * autre chantier au moment de l'extraction — à faire dès que possible, faute de
 * quoi les deux définitions peuvent diverger et un même produit changerait de
 * catégorie selon l'écran qui le regarde.
 */
export function primaryCategoryName(product: Product): string | null {
  const [primary] = [...product.goods].sort(
    (a, b) =>
      Number(a.$extras.pivot_rank ?? 0) - Number(b.$extras.pivot_rank ?? 0) ||
      a.name.localeCompare(b.name)
  )
  return primary?.category?.name ?? null
}
