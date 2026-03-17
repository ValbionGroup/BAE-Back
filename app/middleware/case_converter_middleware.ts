import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function convertKeys(obj: unknown, converter: (key: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, converter))
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const converted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[converter(key)] = convertKeys(value, converter)
    }
    return converted
  }

  return obj
}

export default class CaseConverterMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const body = request.body()
    if (body && typeof body === 'object') {
      request.updateBody(convertKeys(body, toCamelCase) as Record<string, any>)
    }

    const qs = request.qs()
    if (qs && typeof qs === 'object') {
      request.updateQs(convertKeys(qs, toCamelCase) as Record<string, any>)
    }

    await next()

    const responseBody = response.getBody()
    if (responseBody && typeof responseBody === 'object') {
      response.send(convertKeys(responseBody, toSnakeCase))
    }
  }
}
