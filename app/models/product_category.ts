import { ProductCategorySchema } from '#database/schema'

/**
 * Le référentiel de **vente** : « Plats / Desserts / Boissons ».
 *
 * ⚠️ À ne pas confondre avec `Category`, qui classe les **denrées** pour le
 * stockage (« Frais / Sec »). Les deux vocabulaires sont distincts et peuvent
 * partager un mot — « Boissons » figure dans les deux sans que ce soit un
 * doublon : ce ne sont pas les mêmes objets.
 */
export default class ProductCategory extends ProductCategorySchema {}
