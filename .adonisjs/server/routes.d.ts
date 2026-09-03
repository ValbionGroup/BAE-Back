import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'auth.password_reset.request': { paramsTuple?: []; params?: {} }
    'auth.password_reset.reset': { paramsTuple?: []; params?: {} }
    'auth.two_factor.challenge': { paramsTuple?: []; params?: {} }
    'auth.two_factor.verify': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.logout': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.qrs.mine': { paramsTuple?: []; params?: {} }
    'profile.profile.update': { paramsTuple?: []; params?: {} }
    'profile.telegramLink': { paramsTuple?: []; params?: {} }
    'profile.telegramUnlink': { paramsTuple?: []; params?: {} }
    'accountSecurity.account_password.update': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.store': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.confirm': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.recovery_codes': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.disable': { paramsTuple?: []; params?: {} }
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
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'product_categories.store': { paramsTuple?: []; params?: {} }
    'product_categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.index': { paramsTuple?: []; params?: {} }
    'storage_locations.store': { paramsTuple?: []; params?: {} }
    'storage_locations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'goods.attach_barcode': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.remove_barcode': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'goods.set_supplier_price': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'supplierId': ParamValue} }
    'goods.remove_supplier_price': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'supplierId': ParamValue} }
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
    'sponsorship_categories.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.prices': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.qr': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.rotate': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.receivables': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.receivables_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.shopping_list_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'card_payments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'events.notify_assignments': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.open': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'account_preferences.preferences.rankable_jobs': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'account_assignments.assignments.mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.store': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'fast_passes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'fast_passes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'analytics.season': { paramsTuple?: []; params?: {} }
    'payments.index': { paramsTuple?: []; params?: {} }
    'card_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'card_payments.refresh': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'card_payments.destroy': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscriptions.store': { paramsTuple?: []; params?: {} }
    'subscriptions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'fastPassId': ParamValue} }
    'qrs.verify': { paramsTuple?: []; params?: {} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_pickup': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'vouchers.store': { paramsTuple?: []; params?: {} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'activity.activity.index': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.events': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.menu': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_catalog.public_catalog.fast_passes': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.pre_order_qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.subscriptions': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.subscribe': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.pre_order': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'lydia.lydia_callbacks.notify': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'sumup.sumup_callbacks.notify': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'telegram.telegram_webhook.notify': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.password_reset.request': { paramsTuple?: []; params?: {} }
    'auth.password_reset.reset': { paramsTuple?: []; params?: {} }
    'auth.two_factor.verify': { paramsTuple?: []; params?: {} }
    'profile.telegramLink': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.store': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.confirm': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.recovery_codes': { paramsTuple?: []; params?: {} }
    'accountSecurity.two_factor.disable': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'product_categories.store': { paramsTuple?: []; params?: {} }
    'storage_locations.store': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'goods.store': { paramsTuple?: []; params?: {} }
    'goods.attach_barcode': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.store': { paramsTuple?: []; params?: {} }
    'suppliers.store': { paramsTuple?: []; params?: {} }
    'stocks.discard': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'batchId': ParamValue} }
    'stock_batches.store': { paramsTuple?: []; params?: {} }
    'stock_movements.store': { paramsTuple?: []; params?: {} }
    'restocks.store': { paramsTuple?: []; params?: {} }
    'events.store': { paramsTuple?: []; params?: {} }
    'events.set_response': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.rotate': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'orders.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'card_payments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'production_runs.returns': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.run_matching': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.notify_assignments': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.open': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.settle': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'jobs.store': { paramsTuple?: []; params?: {} }
    'event_jobs.store': { paramsTuple?: []; params?: {} }
    'assignments.store': { paramsTuple?: []; params?: {} }
    'job_eligible_members.store': { paramsTuple?: []; params?: {} }
    'fast_passes.store': { paramsTuple?: []; params?: {} }
    'card_payments.refresh': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'card_payments.destroy': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'subscriptions.store': { paramsTuple?: []; params?: {} }
    'qrs.verify': { paramsTuple?: []; params?: {} }
    'pre_orders.collect': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.store': { paramsTuple?: []; params?: {} }
    'notifications.notifications.mark_all_read': { paramsTuple?: []; params?: {} }
    'tickets.tickets.store': { paramsTuple?: []; params?: {} }
    'tickets.tickets.reply': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_payments.subscribe': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.pre_order': { paramsTuple?: []; params?: {} }
    'lydia.lydia_callbacks.notify': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'sumup.sumup_callbacks.notify': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'telegram.telegram_webhook.notify': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'auth.access_token.destroy_all': { paramsTuple?: []; params?: {} }
    'profile.telegramUnlink': { paramsTuple?: []; params?: {} }
    'members.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.remove_barcode': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'goods.remove_supplier_price': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'supplierId': ParamValue} }
    'furnitures.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'sponsorship_categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'jobs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.destroy': { paramsTuple?: []; params?: {} }
    'assignments.destroy': { paramsTuple?: []; params?: {} }
    'job_eligible_members.destroy': { paramsTuple?: []; params?: {} }
    'fast_passes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscriptions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'fastPassId': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'logs.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'auth.two_factor.challenge': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.logout': { paramsTuple?: []; params?: {} }
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
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'storage_locations.index': { paramsTuple?: []; params?: {} }
    'storage_locations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'sponsorship_categories.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.qr': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.receivables': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.receivables_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'account_preferences.preferences.rankable_jobs': { paramsTuple?: []; params?: {} }
    'account_assignments.assignments.mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'analytics.season': { paramsTuple?: []; params?: {} }
    'payments.index': { paramsTuple?: []; params?: {} }
    'card_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.notifications.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'activity.activity.index': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.events': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.menu': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_catalog.public_catalog.fast_passes': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.pre_order_qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.subscriptions': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'auth.two_factor.challenge': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.redirect': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.callback': { paramsTuple?: []; params?: {} }
    'auth.keycloak_auth.logout': { paramsTuple?: []; params?: {} }
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
    'product_categories.index': { paramsTuple?: []; params?: {} }
    'storage_locations.index': { paramsTuple?: []; params?: {} }
    'storage_locations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'sponsorship_categories.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.qr': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'sponsorship_categories.receivables': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.receivables_pdf': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'account_preferences.preferences.rankable_jobs': { paramsTuple?: []; params?: {} }
    'account_assignments.assignments.mine': { paramsTuple?: []; params?: {} }
    'fast_passes.index': { paramsTuple?: []; params?: {} }
    'fast_passes.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple?: []; params?: {} }
    'analytics.season': { paramsTuple?: []; params?: {} }
    'payments.index': { paramsTuple?: []; params?: {} }
    'card_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'clients.summary': { paramsTuple?: []; params?: {} }
    'clients.index': { paramsTuple?: []; params?: {} }
    'clients.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'qrs.search': { paramsTuple?: []; params?: {} }
    'vouchers.index': { paramsTuple?: []; params?: {} }
    'logs.index': { paramsTuple?: []; params?: {} }
    'logs.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sessions.sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.notifications.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.index': { paramsTuple?: []; params?: {} }
    'tickets.tickets.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'activity.activity.index': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.events': { paramsTuple?: []; params?: {} }
    'public_catalog.public_catalog.menu': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_catalog.public_catalog.fast_passes': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.pre_order': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.pre_order_qr': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_purchases.account_purchases.subscriptions': { paramsTuple?: []; params?: {} }
    'account_purchases.account_purchases.orders': { paramsTuple?: []; params?: {} }
    'account_purchases.account_payments.show': { paramsTuple: [ParamValue]; params: {'orderRef': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'profile.profile.update': { paramsTuple?: []; params?: {} }
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'productId': ParamValue} }
    'sponsorship_categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.update': { paramsTuple?: []; params?: {} }
    'assignments.update': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pre_orders.set_pickup': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'notifications.notifications.mark_read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tickets.tickets.set_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'accountSecurity.account_password.update': { paramsTuple?: []; params?: {} }
    'members.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.sync_permissions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'product_categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'storage_locations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'goods.set_supplier_price': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'supplierId': ParamValue} }
    'furnitures.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'suppliers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_batches.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'stock_movements.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'restocks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'events.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sponsorship_categories.prices': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'categoryId': ParamValue} }
    'jobs.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_jobs.update': { paramsTuple?: []; params?: {} }
    'assignments.update': { paramsTuple?: []; params?: {} }
    'account_preferences.preferences.update_mine': { paramsTuple?: []; params?: {} }
    'fast_passes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'clients.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'vouchers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}