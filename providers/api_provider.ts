import { HttpContext } from '@adonisjs/core/http'
import { BaseSerializer } from '@adonisjs/core/transformers'
import { BaseModel } from '@adonisjs/lucid/orm'
import { type SimplePaginatorMetaKeys } from '@adonisjs/lucid/types/querybuilder'

class ApiSerializer extends BaseSerializer<{
  Wrap: 'data'
  PaginationMetaData: SimplePaginatorMetaKeys
}> {
  wrap: 'data' = 'data'

  definePaginationMetaData(metaData: unknown): SimplePaginatorMetaKeys {
    if (!this.isLucidPaginatorMetaData(metaData)) {
      throw new Error(
        'Invalid pagination metadata. Expected metadata to contain Lucid pagination keys'
      )
    }
    return metaData
  }
}

const serializer = new ApiSerializer()

// `BaseSerializer.serialize` cannot handle a Lucid model — it would iterate its
// `$attributes` — and only wraps plain objects, arrays falling through unwrapped.
// We therefore resolve models and recurse into arrays so that collections reach
// the wrapping branch.
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

HttpContext.instanceProperty('serialize', serialize)

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    serialize: typeof serialize
  }
}
