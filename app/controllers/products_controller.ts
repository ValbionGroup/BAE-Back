import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'

export default class ProductsController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Product.query().preload('furnitures')
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { name, isVegetarian, description, recipe } = request.all()
    const product = new Product()
    product.name = name
    product.isVegetarian = isVegetarian
    product.description = description
    product.recipe = recipe
    await product.save()
    return product
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return await Product.query().preload('furnitures').where('id', params.id).firstOrFail()
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const product = await Product.query().preload('furnitures').where('id', params.id).firstOrFail() // We get our product by id
    const { name, isVegetarian, description, recipe } = request.all() // We transfer the new data from the request to constants
    product.name = name // Assigning the data
    product.isVegetarian = isVegetarian // Assigning the data
    product.description = description // Assigning the data
    product.recipe = recipe // Assigning the data
    await product.save() // We save the product to the database
    return product
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const product = await Product.query().preload('furnitures').where('id', params.id).firstOrFail() // Get the product by id
    await product.delete()
  }
}