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
  'auth.password_reset.request': {
    methods: ["POST"]
    pattern: '/v1/auth/password/forgot'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/password_reset').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/password_reset').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['request']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['request']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.password_reset.reset': {
    methods: ["POST"]
    pattern: '/v1/auth/password/reset'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/password_reset').resetPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/password_reset').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['reset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['reset']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.two_factor.challenge': {
    methods: ["GET","HEAD"]
    pattern: '/v1/auth/2fa/challenge'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['challenge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['challenge']>>>
    }
  }
  'auth.two_factor.verify': {
    methods: ["POST"]
    pattern: '/v1/auth/2fa/verify'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').twoFactorVerifyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').twoFactorVerifyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['verify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.keycloak_auth.redirect': {
    methods: ["GET","HEAD"]
    pattern: '/v1/auth/keycloak/redirect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['redirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['redirect']>>>
    }
  }
  'auth.keycloak_auth.callback': {
    methods: ["GET","HEAD"]
    pattern: '/v1/auth/keycloak/callback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['callback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['callback']>>>
    }
  }
  'auth.keycloak_auth.logout': {
    methods: ["GET","HEAD"]
    pattern: '/v1/auth/keycloak/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/keycloak_auth_controller').default['logout']>>>
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
  'profile.qrs.mine': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/qr'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['mine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['mine']>>>
    }
  }
  'profile.profile.update': {
    methods: ["PATCH"]
    pattern: '/v1/account/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/profile').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/profile').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.telegramLink': {
    methods: ["POST"]
    pattern: '/v1/account/telegram/link'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_telegram_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_telegram_controller').default['store']>>>
    }
  }
  'profile.telegramUnlink': {
    methods: ["DELETE"]
    pattern: '/v1/account/telegram/link'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_telegram_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_telegram_controller').default['destroy']>>>
    }
  }
  'accountSecurity.account_password.update': {
    methods: ["PUT"]
    pattern: '/v1/account/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_password_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_password_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'accountSecurity.two_factor.store': {
    methods: ["POST"]
    pattern: '/v1/account/2fa'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['store']>>>
    }
  }
  'accountSecurity.two_factor.confirm': {
    methods: ["POST"]
    pattern: '/v1/account/2fa/confirm'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').twoFactorConfirmValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').twoFactorConfirmValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['confirm']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'accountSecurity.two_factor.recovery_codes': {
    methods: ["POST"]
    pattern: '/v1/account/2fa/recovery-codes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['recoveryCodes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['recoveryCodes']>>>
    }
  }
  'accountSecurity.two_factor.disable': {
    methods: ["POST"]
    pattern: '/v1/account/2fa/disable'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').twoFactorDisableValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').twoFactorDisableValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['disable']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['disable']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/member').updateMemberValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/member').updateMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'roles.sync_permissions': {
    methods: ["PUT"]
    pattern: '/v1/roles/:id/permissions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/role').rolePermissionsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/role').rolePermissionsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['syncPermissions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_controller').default['syncPermissions']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').categoryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').categoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').categoryUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').categoryUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'product_categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/product-categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['index']>>>
    }
  }
  'product_categories.store': {
    methods: ["POST"]
    pattern: '/v1/product-categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').productCategoryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').productCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'product_categories.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/product-categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').productCategoryUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').productCategoryUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'product_categories.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/product-categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/product_categories_controller').default['destroy']>>>
    }
  }
  'storage_locations.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/storage-locations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['index']>>>
    }
  }
  'storage_locations.store': {
    methods: ["POST"]
    pattern: '/v1/storage-locations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').storageLocationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').storageLocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'storage_locations.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/storage-locations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['show']>>>
    }
  }
  'storage_locations.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/storage-locations/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').storageLocationUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').storageLocationUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'storage_locations.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/storage-locations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/storage_locations_controller').default['destroy']>>>
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
  'products.recipe_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/products/:id/recipe/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['recipePdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['recipePdf']>>>
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
      body: ExtractBody<InferInput<(typeof import('#validators/product').productValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/product').productValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/product').productUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/product').productUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').goodStorageLocationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').goodStorageLocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').goodStorageLocationValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').goodStorageLocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'goods.attach_barcode': {
    methods: ["POST"]
    pattern: '/v1/goods/:id/barcodes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').goodBarcodeValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').goodBarcodeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['attachBarcode']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['attachBarcode']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'goods.remove_barcode': {
    methods: ["DELETE"]
    pattern: '/v1/goods/:id/barcodes/:code'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; code: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['removeBarcode']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['removeBarcode']>>>
    }
  }
  'goods.set_supplier_price': {
    methods: ["PUT"]
    pattern: '/v1/goods/:id/suppliers/:supplierId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').supplierPriceValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; supplierId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').supplierPriceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['setSupplierPrice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['setSupplierPrice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'goods.remove_supplier_price': {
    methods: ["DELETE"]
    pattern: '/v1/goods/:id/suppliers/:supplierId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; supplierId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['removeSupplierPrice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/goods_controller').default['removeSupplierPrice']>>>
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').supplierValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').supplierValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/catalog').supplierUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog').supplierUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'stock_batches.inventory_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-batches/inventory/pdf'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['inventoryPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['inventoryPdf']>>>
    }
  }
  'stock_batches.labels_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/stock-batches/labels/pdf'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['labelsPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_batches_controller').default['labelsPdf']>>>
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
      body: ExtractBody<InferInput<(typeof import('#validators/stock').stockMovementValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock').stockMovementValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/stock').stockMovementUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/stock').stockMovementUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/event').eventValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/event').eventValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      body: ExtractBody<InferInput<(typeof import('#validators/event').eventUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/event').eventUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'event_products.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/products'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['index']>>>
    }
  }
  'event_products.store': {
    methods: ["POST"]
    pattern: '/v1/events/:id/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/event_product').eventProductValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/event_product').eventProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'event_products.update': {
    methods: ["PATCH"]
    pattern: '/v1/events/:id/products/:productId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/event_product').eventProductUpdateValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; productId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/event_product').eventProductUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'event_products.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/events/:id/products/:productId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; productId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['destroy']>>>
    }
  }
  'sponsorship_categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/sponsorship-categories'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['index']>>>
    }
  }
  'sponsorship_categories.store': {
    methods: ["POST"]
    pattern: '/v1/events/:id/sponsorship-categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sponsorship').sponsorshipCategoryValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/sponsorship').sponsorshipCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sponsorship_categories.update': {
    methods: ["PATCH"]
    pattern: '/v1/events/:id/sponsorship-categories/:categoryId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sponsorship').sponsorshipCategoryPatchValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; categoryId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/sponsorship').sponsorshipCategoryPatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sponsorship_categories.prices': {
    methods: ["PUT"]
    pattern: '/v1/events/:id/sponsorship-categories/:categoryId/prices'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/sponsorship').sponsorshipPricesValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; categoryId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/sponsorship').sponsorshipPricesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['prices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['prices']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sponsorship_categories.qr': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/sponsorship-categories/:categoryId/qr'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; categoryId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['qr']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['qr']>>>
    }
  }
  'sponsorship_categories.rotate': {
    methods: ["POST"]
    pattern: '/v1/events/:id/sponsorship-categories/:categoryId/qr/rotate'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; categoryId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['rotate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['rotate']>>>
    }
  }
  'sponsorship_categories.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/events/:id/sponsorship-categories/:categoryId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; categoryId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['destroy']>>>
    }
  }
  'sponsorship_categories.receivables': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/receivables'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['receivables']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['receivables']>>>
    }
  }
  'sponsorship_categories.receivables_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/receivables/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['receivablesPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sponsorship_categories_controller').default['receivablesPdf']>>>
    }
  }
  'event_products.shopping_list': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/shopping-list'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['shoppingList']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['shoppingList']>>>
    }
  }
  'event_products.shopping_list_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/shopping-list/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['shoppingListPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/event_products_controller').default['shoppingListPdf']>>>
    }
  }
  'orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
    }
  }
  'orders.store': {
    methods: ["POST"]
    pattern: '/v1/events/:id/orders'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order').orderCheckoutValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order').orderCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'card_payments.store': {
    methods: ["POST"]
    pattern: '/v1/events/:id/card-payments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/card_payment').cardPaymentOpenValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/card_payment').cardPaymentOpenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.sellable': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/sellable'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['sellable']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['sellable']>>>
    }
  }
  'orders.summary': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/summary'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['summary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['summary']>>>
    }
  }
  'pre_orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/pre-orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['index']>>>
    }
  }
  'production_runs.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/production-runs'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['index']>>>
    }
  }
  'production_runs.store': {
    methods: ["POST"]
    pattern: '/v1/events/:id/production-runs'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['store']>>>
    }
  }
  'production_runs.production_plan_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/production-plan/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['productionPlanPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['productionPlanPdf']>>>
    }
  }
  'production_runs.return_state': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/production-returns'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['returnState']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['returnState']>>>
    }
  }
  'production_runs.returns': {
    methods: ["POST"]
    pattern: '/v1/events/:id/production-returns'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['returns']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['returns']>>>
    }
  }
  'production_runs.production_returns_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/production-returns/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['productionReturnsPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/production_runs_controller').default['productionReturnsPdf']>>>
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
  'events.notify_assignments': {
    methods: ["POST"]
    pattern: '/v1/events/:id/assignments/notify'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['notifyAssignments']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['notifyAssignments']>>>
    }
  }
  'events.open': {
    methods: ["POST"]
    pattern: '/v1/events/:id/open'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['open']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['open']>>>
    }
  }
  'events.settle': {
    methods: ["POST"]
    pattern: '/v1/events/:id/settle'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/events_controller').default['settle']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/events_controller').default['settle']>>>
    }
  }
  'assignments.pdf': {
    methods: ["GET","HEAD"]
    pattern: '/v1/events/:id/assignments/pdf'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['pdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['pdf']>>>
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
  'account_preferences.preferences.rankable_jobs': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/preferences/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['rankableJobs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/preferences_controller').default['rankableJobs']>>>
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
  'account_assignments.assignments.mine': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/assignments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['mine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/assignments_controller').default['mine']>>>
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
  'analytics.season': {
    methods: ["GET","HEAD"]
    pattern: '/v1/analytics/season'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/analytics_controller').default['season']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/analytics_controller').default['season']>>>
    }
  }
  'payments.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/payments_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/payments_controller').default['index']>>>
    }
  }
  'card_payments.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/card-payments/:orderRef'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['show']>>>
    }
  }
  'card_payments.refresh': {
    methods: ["POST"]
    pattern: '/v1/card-payments/:orderRef/refresh'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['refresh']>>>
    }
  }
  'card_payments.destroy': {
    methods: ["POST"]
    pattern: '/v1/card-payments/:orderRef/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/card_payments_controller').default['destroy']>>>
    }
  }
  'clients.summary': {
    methods: ["GET","HEAD"]
    pattern: '/v1/clients/summary'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['summary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['summary']>>>
    }
  }
  'clients.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/clients'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['index']>>>
    }
  }
  'clients.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/clients/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['show']>>>
    }
  }
  'clients.update': {
    methods: ["PUT","PATCH"]
    pattern: '/v1/clients/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/client').updateClientValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/client').updateClientValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'clients.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/clients/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/clients_controller').default['destroy']>>>
    }
  }
  'subscriptions.store': {
    methods: ["POST"]
    pattern: '/v1/subscriptions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subscription').createSubscriptionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/subscription').createSubscriptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/subscriptions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/subscriptions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'subscriptions.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/subscriptions/:userId/:fastPassId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; fastPassId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/subscriptions_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/subscriptions_controller').default['destroy']>>>
    }
  }
  'qrs.verify': {
    methods: ["POST"]
    pattern: '/v1/qr/verify'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/qr').qrVerifyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/qr').qrVerifyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['verify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'qrs.search': {
    methods: ["GET","HEAD"]
    pattern: '/v1/buyers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/qr').buyerSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/qrs_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.set_status': {
    methods: ["PATCH"]
    pattern: '/v1/orders/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order').orderStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order').orderStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['setStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['setStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.destroy': {
    methods: ["DELETE"]
    pattern: '/v1/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['destroy']>>>
    }
  }
  'pre_orders.set_status': {
    methods: ["PATCH"]
    pattern: '/v1/pre-orders/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order').orderStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order').orderStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['setStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['setStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'pre_orders.set_pickup': {
    methods: ["PATCH"]
    pattern: '/v1/pre-orders/:id/pickup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order').preOrderPickupValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order').preOrderPickupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['setPickup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['setPickup']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'pre_orders.collect': {
    methods: ["POST"]
    pattern: '/v1/pre-orders/:id/collect'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['collect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pre_orders_controller').default['collect']>>>
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
  'notifications.notifications.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/notifications'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['index']>>>
    }
  }
  'notifications.notifications.mark_read': {
    methods: ["PATCH"]
    pattern: '/v1/account/notifications/:id/read'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markRead']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markRead']>>>
    }
  }
  'notifications.notifications.mark_all_read': {
    methods: ["POST"]
    pattern: '/v1/account/notifications/read-all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markAllRead']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['markAllRead']>>>
    }
  }
  'tickets.tickets.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/tickets'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['index']>>>
    }
  }
  'tickets.tickets.store': {
    methods: ["POST"]
    pattern: '/v1/tickets'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ticket').ticketOpenValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/ticket').ticketOpenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'tickets.tickets.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/tickets/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['show']>>>
    }
  }
  'tickets.tickets.reply': {
    methods: ["POST"]
    pattern: '/v1/tickets/:id/messages'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ticket').ticketReplyValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ticket').ticketReplyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['reply']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['reply']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'tickets.tickets.set_status': {
    methods: ["PATCH"]
    pattern: '/v1/tickets/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ticket').ticketStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ticket').ticketStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['setStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tickets_controller').default['setStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'activity.activity.index': {
    methods: ["GET","HEAD"]
    pattern: '/v1/activity'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/activity_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/activity_controller').default['index']>>>
    }
  }
  'public_catalog.public_catalog.events': {
    methods: ["GET","HEAD"]
    pattern: '/v1/public/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['events']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['events']>>>
    }
  }
  'public_catalog.public_catalog.menu': {
    methods: ["GET","HEAD"]
    pattern: '/v1/public/events/:id/menu'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['menu']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['menu']>>>
    }
  }
  'public_catalog.public_catalog.fast_passes': {
    methods: ["GET","HEAD"]
    pattern: '/v1/public/fast-passes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['fastPasses']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/public_catalog_controller').default['fastPasses']>>>
    }
  }
  'account_purchases.account_purchases.pre_orders': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/pre-orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrders']>>>
    }
  }
  'account_purchases.account_purchases.pre_order': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/pre-orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrder']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrder']>>>
    }
  }
  'account_purchases.account_purchases.pre_order_qr': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/pre-orders/:id/qr'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrderQr']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['preOrderQr']>>>
    }
  }
  'account_purchases.account_purchases.subscriptions': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/subscriptions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['subscriptions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['subscriptions']>>>
    }
  }
  'account_purchases.account_purchases.orders': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['orders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_purchases_controller').default['orders']>>>
    }
  }
  'account_purchases.account_payments.subscribe': {
    methods: ["POST"]
    pattern: '/v1/account/subscriptions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account_purchase').createAccountSubscriptionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account_purchase').createAccountSubscriptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['subscribe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['subscribe']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account_purchases.account_payments.pre_order': {
    methods: ["POST"]
    pattern: '/v1/account/pre-orders'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account_purchase').createAccountPreOrderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account_purchase').createAccountPreOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['preOrder']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['preOrder']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account_purchases.account_payments.show': {
    methods: ["GET","HEAD"]
    pattern: '/v1/account/payments/:orderRef'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_payments_controller').default['show']>>>
    }
  }
  'lydia.lydia_callbacks.notify': {
    methods: ["POST"]
    pattern: '/v1/lydia/callback/:orderRef'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/lydia_callbacks_controller').default['notify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/lydia_callbacks_controller').default['notify']>>>
    }
  }
  'sumup.sumup_callbacks.notify': {
    methods: ["POST"]
    pattern: '/v1/sumup/callback/:orderRef'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderRef: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sumup_callbacks_controller').default['notify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sumup_callbacks_controller').default['notify']>>>
    }
  }
  'telegram.telegram_webhook.notify': {
    methods: ["POST"]
    pattern: '/v1/telegram/webhook'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/telegram_webhook_controller').default['notify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/telegram_webhook_controller').default['notify']>>>
    }
  }
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
