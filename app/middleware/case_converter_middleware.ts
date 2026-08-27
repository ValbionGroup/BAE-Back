import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { DateTime } from 'luxon'
import { BaseModel } from '@adonisjs/lucid/orm'

/**
 * Les clés converties sont mémoïsées : ce sont les colonnes du schéma, un
 * ensemble petit et fini, mais réutilisé des milliers de fois dans une seule
 * réponse — une liste de produits répète les mêmes vingt clés à chaque ligne.
 * Sans cache, chaque occurrence repayait ses deux `String.replace`.
 *
 * Les caches sont bornés : au-delà, ils sont vidés plutôt que de grossir sans
 * fin. Une charge utile peut porter des clés arbitraires — un `payload` JSONB,
 * une query string forgée — et un cache non borné en ferait une fuite mémoire
 * qu'un tiers pourrait provoquer.
 */
const MAX_CACHE_ENTRIES = 4_096

function memoize(convert: (str: string) => string): (str: string) => string {
  const cache = new Map<string, string>()

  return (str: string): string => {
    const hit = cache.get(str)
    if (hit !== undefined) return hit

    const converted = convert(str)
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear()
    cache.set(str, converted)
    return converted
  }
}

const toSnakeCase = memoize((str: string) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
)

const toCamelCase = memoize((str: string) =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
)

function convertKeys(obj: unknown, converter: (key: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, converter))
  }

  if (obj instanceof BaseModel) {
    return convertKeys(obj.serialize(), converter)
  }

  // `isDateTime` only checks the `isLuxonDateTime` marker, which survives a JSON
  // round-trip while the prototype does not: a DateTime stored in a JSON column
  // reads back as a plain object that claims to be one but has no `toISO`.
  if (DateTime.isDateTime(obj) && typeof obj.toISO === 'function') {
    return obj.toISO()
  }

  // A Buffer is a Uint8Array: its byte indices are own enumerable
  // properties, so without this guard Object.entries() would read it as a
  // plain object — `{"0":37,"1":80,...}` — and JSON-serialize every byte.
  // The seven printed PDFs all send a raw Buffer as their response body.
  if (Buffer.isBuffer(obj)) {
    return obj
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
