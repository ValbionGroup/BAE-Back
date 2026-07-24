import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'members.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.store': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.index': { paramsTuple?: []; params?: {} }
    'goods.store': { paramsTuple?: []; params?: {} }
    'goods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.store': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.store': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.store': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.store': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.store': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.store': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'furnitures.store': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'goods.store': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'restocks.store': { paramsTuple?: []; params?: {} }
    'stock_batches.store': { paramsTuple?: []; params?: {} }
    'stock_movements.store': { paramsTuple?: []; params?: {} }
    'logs.store': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'permissions.store': { paramsTuple?: []; params?: {} }
    'events.store': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'members.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.index': { paramsTuple?: []; params?: {} }
    'goods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.index': { paramsTuple?: []; params?: {} }
    'goods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}