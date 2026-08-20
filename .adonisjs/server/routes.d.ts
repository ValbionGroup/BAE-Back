import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.qrs.mine': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'members.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.sync_permissions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.summary': { paramsTuple?: []; params?: {} }
    'products.ingredients': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.recipe_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.store': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stocks.index': { paramsTuple?: []; params?: {} }
    'stocks.batches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stocks.discard': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'batchId': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.store': { paramsTuple?: []; params?: {} }
    'stock_batches.inventory_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.labels_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.store': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.store': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.store': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.get_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.set_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.roster': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'event_products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'event_products.shopping_list': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.sellable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.summary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_plan_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.return_state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.returns': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_returns_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.run_matching': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.settle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'assignments.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.store': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.index': { paramsTuple?: []; params?: {} }
    'event_jobs.store': { paramsTuple?: []; params?: {} }
    'event_jobs.update': { paramsTuple?: []; params?: {} }
    'event_jobs.destroy': { paramsTuple?: []; params?: {} }
    'assignments.index': { paramsTuple?: []; params?: {} }
    'assignments.store': { paramsTuple?: []; params?: {} }
    'assignments.update': { paramsTuple?: []; params?: {} }
    'assignments.destroy': { paramsTuple?: []; params?: {} }
    'responses.index': { paramsTuple?: []; params?: {} }
    'preferences.index': { paramsTuple?: []; params?: {} }
    'job_eligible_members.index': { paramsTuple?: []; params?: {} }
    'job_eligible_members.store': { paramsTuple?: []; params?: {} }
    'job_eligible_members.destroy': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.mine': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.store': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'fast_passes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'fast_passes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'qrs.verify': { paramsTuple?: []; params?: {} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscriptions.store': { paramsTuple?: []; params?: {} }
    'subscriptions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'fastPassId': ParamValue} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'vouchers.store': { paramsTuple?: []; params?: {} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.store': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.index': { paramsTuple?: []; params?: {} }
    'sessions.sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'notifications.notifications.index': { paramsTuple?: []; params?: {} }
    'notifications.notifications.mark_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'notifications.notifications.mark_all_read': { paramsTuple?: []; params?: {} }
    'tickets.tickets.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.store': { paramsTuple?: []; params?: {} }
    'tickets.tickets.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tickets.tickets.reply': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tickets.tickets.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'goods.store': { paramsTuple?: []; params?: {} }
    'furnitures.store': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'stocks.discard': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'batchId': ParamValue} }
    'stock_batches.store': { paramsTuple?: []; params?: {} }
    'stock_movements.store': { paramsTuple?: []; params?: {} }
    'restocks.store': { paramsTuple?: []; params?: {} }
    'events.store': { paramsTuple?: []; params?: {} }
    'events.set_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.returns': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.run_matching': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.settle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.store': { paramsTuple?: []; params?: {} }
    'event_jobs.store': { paramsTuple?: []; params?: {} }
    'assignments.store': { paramsTuple?: []; params?: {} }
    'job_eligible_members.store': { paramsTuple?: []; params?: {} }
    'fast_passes.store': { paramsTuple?: []; params?: {} }
    'qrs.verify': { paramsTuple?: []; params?: {} }
    'pre_orders.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscriptions.store': { paramsTuple?: []; params?: {} }
    'vouchers.store': { paramsTuple?: []; params?: {} }
    'logs.store': { paramsTuple?: []; params?: {} }
    'notifications.notifications.mark_all_read': { paramsTuple?: []; params?: {} }
    'tickets.tickets.store': { paramsTuple?: []; params?: {} }
    'tickets.tickets.reply': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'members.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'jobs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.destroy': { paramsTuple?: []; params?: {} }
    'assignments.destroy': { paramsTuple?: []; params?: {} }
    'job_eligible_members.destroy': { paramsTuple?: []; params?: {} }
    'fast_passes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscriptions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'fastPassId': ParamValue} }
    'vouchers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.qrs.mine': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.summary': { paramsTuple?: []; params?: {} }
    'products.ingredients': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.recipe_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.index': { paramsTuple?: []; params?: {} }
    'goods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stocks.index': { paramsTuple?: []; params?: {} }
    'stocks.batches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.inventory_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.labels_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.get_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.roster': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.sellable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.summary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_plan_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.return_state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_returns_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'assignments.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.index': { paramsTuple?: []; params?: {} }
    'assignments.index': { paramsTuple?: []; params?: {} }
    'responses.index': { paramsTuple?: []; params?: {} }
    'preferences.index': { paramsTuple?: []; params?: {} }
    'job_eligible_members.index': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.notifications.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.qrs.mine': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permissions.index': { paramsTuple?: []; params?: {} }
    'permissions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.summary': { paramsTuple?: []; params?: {} }
    'products.ingredients': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.recipe_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.index': { paramsTuple?: []; params?: {} }
    'goods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.index': { paramsTuple?: []; params?: {} }
    'furnitures.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.index': { paramsTuple?: []; params?: {} }
    'suppliers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stocks.index': { paramsTuple?: []; params?: {} }
    'stocks.batches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.index': { paramsTuple?: []; params?: {} }
    'stock_batches.inventory_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.labels_pdf': { paramsTuple?: []; params?: {} }
    'stock_batches.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.index': { paramsTuple?: []; params?: {} }
    'stock_movements.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.index': { paramsTuple?: []; params?: {} }
    'restocks.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.index': { paramsTuple?: []; params?: {} }
    'events.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.get_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.roster': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.sellable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.summary': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_plan_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.return_state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.production_returns_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'assignments.pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.index': { paramsTuple?: []; params?: {} }
    'jobs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.index': { paramsTuple?: []; params?: {} }
    'assignments.index': { paramsTuple?: []; params?: {} }
    'responses.index': { paramsTuple?: []; params?: {} }
    'preferences.index': { paramsTuple?: []; params?: {} }
    'job_eligible_members.index': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.notifications.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.sync_permissions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.update': { paramsTuple?: []; params?: {} }
    'assignments.update': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'fast_passes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.update': { paramsTuple?: []; params?: {} }
    'assignments.update': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'notifications.notifications.mark_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tickets.tickets.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}