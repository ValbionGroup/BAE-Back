import { HttpContext } from '@adonisjs/core/http'
import { BaseSerializer } from '@adonisjs/core/transformers'
import { BaseModel } from '@adonisjs/lucid/orm'
import { type SimplePaginatorMetaKeys } from '@adonisjs/lucid/types/querybuilder'

/**
 * Custom serializer for API responses that ensures consistent JSON structure
 * across all API endpoints. Wraps response data in a 'data' property and handles
 * pagination metadata for Lucid ORM query results.
 */
class ApiSerializer extends BaseSerializer<{
  Wrap: 'data'
  PaginationMetaData: SimplePaginatorMetaKeys
}> {
  /**
   * Wraps all serialized data under this key in the response object.
   * Example: { data: [...] } instead of returning raw arrays/objects
   */
  wrap: 'data' = 'data'

  /**
   * Validates and defines pagination metadata structure for paginated responses.
   * Ensures that pagination info from Lucid queries is properly formatted.
   *
   * @throws Error if metadata doesn't match Lucid's pagination structure
   */
  definePaginationMetaData(metaData: unknown): SimplePaginatorMetaKeys {
    if (!this.isLucidPaginatorMetaData(metaData)) {
      throw new Error(
        'Invalid pagination metadata. Expected metadata to contain Lucid pagination keys'
      )
    }
    return metaData
  }
}

/**
 * Single instance of ApiSerializer used across the application
 */
const serializer = new ApiSerializer()

/**
 * Normalizes a value into plain data before serialization.
 *
 * BaseSerializer.serialize cannot handle Lucid models directly (it would iterate
 * their internal `$attributes`) and only wraps plain objects — arrays fall through
 * unwrapped. We resolve models to their serialized form and recurse into arrays so
 * that collections reach the wrapping branch below.
 */
function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toPlain)
  }
  if (value instanceof BaseModel) {
    return value.serialize()
  }
  return value
}

const serialize = Object.assign(
  (data: unknown): Promise<{ data: any }> => {
    const normalized = toPlain(data)
    if (Array.isArray(normalized)) {
      return Promise.resolve({ [serializer.wrap]: normalized })
    }
    return serializer.serialize(normalized as Record<string, any>)
  },
  { withoutWrapping: serializer.serializeWithoutWrapping.bind(serializer) }
)

/**
 * Adds the serialize method to all HttpContext instances.
 * Usage in controllers: return ctx.serialize(data)
 * This ensures all API responses follow the same structure with data wrapping.
 */
HttpContext.instanceProperty('serialize', serialize)

/**
 * Module augmentation to add the serialize method to HttpContext.
 * This allows controllers to use ctx.serialize() for consistent API responses.
 */
declare module '@adonisjs/core/http' {
  export interface HttpContext {
    serialize: typeof serialize
  }
}
