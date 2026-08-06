/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_token.store': {
    methods: ["POST"]
    pattern: '/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_token.destroy': {
    methods: ["POST"]
    pattern: '/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroy']>>>
    }
  }
  'auth.access_token.destroy_all': {
    methods: ["DELETE"]
    pattern: '/v1/auth/logout-all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroyAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroyAll']>>>
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'members.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/members'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['index']>>>
    }
  }
  'members.store': {
    methods: ["POST"]
    pattern: '/v1/members'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['store']>>>
    }
  }
  'members.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/members/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['show']>>>
    }
  }
  'members.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/members/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['update']>>>
    }
  }
  'members.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/members/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['destroy']>>>
    }
  }
  'roles.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/roles'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['index']>>>
    }
  }
  'roles.store': {
    methods: ["POST"]
    pattern: '/v1/roles'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['store']>>>
    }
  }
  'roles.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/roles/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['show']>>>
    }
  }
  'roles.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/roles/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['update']>>>
    }
  }
  'roles.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/roles/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['destroy']>>>
    }
  }
  'permissions.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/permissions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['index']>>>
    }
  }
  'permissions.store': {
    methods: ["POST"]
    pattern: '/v1/permissions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['store']>>>
    }
  }
  'permissions.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/permissions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['show']>>>
    }
  }
  'permissions.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/permissions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['update']>>>
    }
  }
  'permissions.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/permissions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/permissions_controller').default['destroy']>>>
    }
  }
  'categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
    }
  }
  'categories.store': {
    methods: ["POST"]
    pattern: '/v1/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>>
    }
  }
  'categories.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['show']>>>
    }
  }
  'categories.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
    }
  }
  'categories.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>>
    }
  }
  'products.summary': {
    methods: ["GET","HEAD"]
    pattern: '/v1/products/summary'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['summary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['summary']>>>
    }
  }
  'products.ingredients': {
    methods: ["GET","HEAD"]
    pattern: '/v1/products/:id/ingredients'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['ingredients']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['ingredients']>>>
    }
  }
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
    }
  }
  'products.store': {
    methods: ["POST"]
    pattern: '/v1/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
    }
  }
  'products.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
    }
  }
  'products.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
    }
  }
  'goods.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/goods'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['index']>>>
    }
  }
  'goods.store': {
    methods: ["POST"]
    pattern: '/v1/goods'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['store']>>>
    }
  }
  'goods.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/goods/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['show']>>>
    }
  }
  'goods.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/goods/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['update']>>>
    }
  }
  'goods.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/goods/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['destroy']>>>
    }
  }
  'furnitures.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/furnitures'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['index']>>>
    }
  }
  'furnitures.store': {
    methods: ["POST"]
    pattern: '/v1/furnitures'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['store']>>>
    }
  }
  'furnitures.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/furnitures/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['show']>>>
    }
  }
  'furnitures.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/furnitures/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['update']>>>
    }
  }
  'furnitures.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/furnitures/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/furnitures_controller').default['destroy']>>>
    }
  }
  'suppliers.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/suppliers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
    }
  }
  'suppliers.store': {
    methods: ["POST"]
    pattern: '/v1/suppliers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>>
    }
  }
  'suppliers.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['show']>>>
    }
  }
  'suppliers.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>>
    }
  }
  'suppliers.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/suppliers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['destroy']>>>
    }
  }
  'stocks.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stocks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['index']>>>
    }
  }
  'stocks.batches': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stocks/:id/batches'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['batches']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['batches']>>>
    }
  }
  'stocks.discard': {
    methods: ["POST"]
    pattern: '/v1/stocks/:id/batches/:batchId/discard'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; batchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['discard']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stocks_controller').default['discard']>>>
    }
  }
  'stock_batches.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-batches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['index']>>>
    }
  }
  'stock_batches.store': {
    methods: ["POST"]
    pattern: '/v1/stock-batches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['store']>>>
    }
  }
  'stock_batches.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-batches/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['show']>>>
    }
  }
  'stock_batches.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/stock-batches/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['update']>>>
    }
  }
  'stock_batches.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/stock-batches/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['destroy']>>>
    }
  }
  'stock_movements.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['index']>>>
    }
  }
  'stock_movements.store': {
    methods: ["POST"]
    pattern: '/v1/stock-movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['store']>>>
    }
  }
  'stock_movements.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-movements/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['show']>>>
    }
  }
  'stock_movements.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/stock-movements/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['update']>>>
    }
  }
  'stock_movements.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/stock-movements/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['destroy']>>>
    }
  }
  'restocks.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/restocks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['index']>>>
    }
  }
  'restocks.store': {
    methods: ["POST"]
    pattern: '/v1/restocks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['store']>>>
    }
  }
  'restocks.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/restocks/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['show']>>>
    }
  }
  'restocks.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/restocks/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['update']>>>
    }
  }
  'restocks.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/restocks/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/restocks_controller').default['destroy']>>>
    }
  }
  'events.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['index']>>>
    }
  }
  'events.store': {
    methods: ["POST"]
    pattern: '/v1/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['store']>>>
    }
  }
  'events.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['show']>>>
    }
  }
  'events.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/events/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['update']>>>
    }
  }
  'events.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/events/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['destroy']>>>
    }
  }
  'events.get_response': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/response'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['getResponse']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['getResponse']>>>
    }
  }
  'events.set_response': {
    methods: ["POST"]
    pattern: '/v1/events/:id/response'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/event').availabilityValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/event').availabilityValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['setResponse']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['setResponse']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'events.roster': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/roster'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['roster']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['roster']>>>
    }
  }
  'events.run_matching': {
    methods: ["POST"]
    pattern: '/v1/events/:id/matching'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['runMatching']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['runMatching']>>>
    }
  }
  'jobs.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['index']>>>
    }
  }
  'jobs.store': {
    methods: ["POST"]
    pattern: '/v1/jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').jobValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').jobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/jobs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['show']>>>
    }
  }
  'jobs.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/jobs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').jobValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').jobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'jobs.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/jobs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/jobs_controller').default['destroy']>>>
    }
  }
  'event_jobs.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/event-jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['index']>>>
    }
  }
  'event_jobs.store': {
    methods: ["POST"]
    pattern: '/v1/event-jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').eventJobValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').eventJobValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'event_jobs.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/event-jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').eventJobCountValidator)>|InferInput<(typeof import('#validators/coordination').eventJobKeyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').eventJobCountValidator)>|InferInput<(typeof import('#validators/coordination').eventJobKeyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'event_jobs.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/event-jobs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').eventJobKeyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').eventJobKeyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_jobs_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'assignments.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/assignments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['index']>>>
    }
  }
  'assignments.store': {
    methods: ["POST"]
    pattern: '/v1/assignments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'assignments.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/assignments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').assignmentLockValidator)>|InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').assignmentLockValidator)>|InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'assignments.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/assignments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').assignmentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'responses.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/responses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/responses_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/responses_controller').default['index']>>>
    }
  }
  'preferences.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/preferences'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['index']>>>
    }
  }
  'job_eligible_members.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/job-eligible-members'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['index']>>>
    }
  }
  'job_eligible_members.store': {
    methods: ["POST"]
    pattern: '/v1/job-eligible-members'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').jobEligibleMemberValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').jobEligibleMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'job_eligible_members.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/job-eligible-members'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').jobEligibleMemberValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').jobEligibleMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/job_eligible_members_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account_preferences.preferences.mine': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/preferences'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['mine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['mine']>>>
    }
  }
  'account_preferences.preferences.update_mine': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/account/preferences'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/coordination').jobPreferencesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/coordination').jobPreferencesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['updateMine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['updateMine']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'fast_passes.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/fast-passes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['index']>>>
    }
  }
  'fast_passes.store': {
    methods: ["POST"]
    pattern: '/v1/fast-passes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['store']>>>
    }
  }
  'fast_passes.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/fast-passes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['show']>>>
    }
  }
  'fast_passes.update': {
    methods: ["PUT"]
    pattern: '/v1/fast-passes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['update']>>>
    }
  }
  'fast_passes.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/fast-passes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/fast_passes_controller').default['destroy']>>>
    }
  }
  'transactions.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/transactions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transactions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transactions_controller').default['index']>>>
    }
  }
  'vouchers.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/vouchers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['index']>>>
    }
  }
  'vouchers.store': {
    methods: ["POST"]
    pattern: '/v1/vouchers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/voucher').voucherValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/voucher').voucherValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'vouchers.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/vouchers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/voucher').voucherUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/voucher').voucherUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'vouchers.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/vouchers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/vouchers_controller').default['destroy']>>>
    }
  }
  'logs.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/logs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['index']>>>
    }
  }
  'logs.store': {
    methods: ["POST"]
    pattern: '/v1/logs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['store']>>>
    }
  }
  'logs.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/logs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['show']>>>
    }
  }
  'logs.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/logs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['update']>>>
    }
  }
  'logs.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/logs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logs_controller').default['destroy']>>>
    }
  }
  'sessions.sessions.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/sessions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['index']>>>
    }
  }
  'sessions.sessions.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/account/sessions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sessions_controller').default['destroy']>>>
    }
  }
}
