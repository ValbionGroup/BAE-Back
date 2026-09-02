/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessToken: {
      store: typeof routes['auth.access_token.store']
      destroy: typeof routes['auth.access_token.destroy']
      destroyAll: typeof routes['auth.access_token.destroy_all']
    }
    passwordReset: {
      request: typeof routes['auth.password_reset.request']
      reset: typeof routes['auth.password_reset.reset']
    }
    twoFactor: {
      challenge: typeof routes['auth.two_factor.challenge']
      verify: typeof routes['auth.two_factor.verify']
    }
    keycloakAuth: {
      redirect: typeof routes['auth.keycloak_auth.redirect']
      callback: typeof routes['auth.keycloak_auth.callback']
      logout: typeof routes['auth.keycloak_auth.logout']
    }
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
      update: typeof routes['profile.profile.update']
    }
    qrs: {
      mine: typeof routes['profile.qrs.mine']
    }
    telegramLink: typeof routes['profile.telegramLink']
    telegramUnlink: typeof routes['profile.telegramUnlink']
  }
  accountSecurity: {
    accountPassword: {
      update: typeof routes['accountSecurity.account_password.update']
    }
    twoFactor: {
      store: typeof routes['accountSecurity.two_factor.store']
      confirm: typeof routes['accountSecurity.two_factor.confirm']
      recoveryCodes: typeof routes['accountSecurity.two_factor.recovery_codes']
      disable: typeof routes['accountSecurity.two_factor.disable']
    }
  }
  members: {
    index: typeof routes['members.index']
    store: typeof routes['members.store']
    show: typeof routes['members.show']
    update: typeof routes['members.update']
    destroy: typeof routes['members.destroy']
  }
  roles: {
    index: typeof routes['roles.index']
    store: typeof routes['roles.store']
    show: typeof routes['roles.show']
    update: typeof routes['roles.update']
    destroy: typeof routes['roles.destroy']
    syncPermissions: typeof routes['roles.sync_permissions']
  }
  permissions: {
    index: typeof routes['permissions.index']
    show: typeof routes['permissions.show']
  }
  categories: {
    index: typeof routes['categories.index']
    store: typeof routes['categories.store']
    show: typeof routes['categories.show']
    update: typeof routes['categories.update']
    destroy: typeof routes['categories.destroy']
  }
  productCategories: {
    index: typeof routes['product_categories.index']
    store: typeof routes['product_categories.store']
    update: typeof routes['product_categories.update']
    destroy: typeof routes['product_categories.destroy']
  }
  storageLocations: {
    index: typeof routes['storage_locations.index']
    store: typeof routes['storage_locations.store']
    show: typeof routes['storage_locations.show']
    update: typeof routes['storage_locations.update']
    destroy: typeof routes['storage_locations.destroy']
  }
  products: {
    summary: typeof routes['products.summary']
    ingredients: typeof routes['products.ingredients']
    recipePdf: typeof routes['products.recipe_pdf']
    index: typeof routes['products.index']
    store: typeof routes['products.store']
    show: typeof routes['products.show']
    update: typeof routes['products.update']
    destroy: typeof routes['products.destroy']
  }
  goods: {
    index: typeof routes['goods.index']
    store: typeof routes['goods.store']
    show: typeof routes['goods.show']
    update: typeof routes['goods.update']
    destroy: typeof routes['goods.destroy']
    attachBarcode: typeof routes['goods.attach_barcode']
    removeBarcode: typeof routes['goods.remove_barcode']
    setSupplierPrice: typeof routes['goods.set_supplier_price']
    removeSupplierPrice: typeof routes['goods.remove_supplier_price']
  }
  furnitures: {
    index: typeof routes['furnitures.index']
    store: typeof routes['furnitures.store']
    show: typeof routes['furnitures.show']
    update: typeof routes['furnitures.update']
    destroy: typeof routes['furnitures.destroy']
  }
  suppliers: {
    index: typeof routes['suppliers.index']
    store: typeof routes['suppliers.store']
    show: typeof routes['suppliers.show']
    update: typeof routes['suppliers.update']
    destroy: typeof routes['suppliers.destroy']
  }
  stocks: {
    index: typeof routes['stocks.index']
    batches: typeof routes['stocks.batches']
    discard: typeof routes['stocks.discard']
  }
  stockBatches: {
    index: typeof routes['stock_batches.index']
    store: typeof routes['stock_batches.store']
    inventoryPdf: typeof routes['stock_batches.inventory_pdf']
    labelsPdf: typeof routes['stock_batches.labels_pdf']
    show: typeof routes['stock_batches.show']
    update: typeof routes['stock_batches.update']
    destroy: typeof routes['stock_batches.destroy']
  }
  stockMovements: {
    index: typeof routes['stock_movements.index']
    store: typeof routes['stock_movements.store']
    show: typeof routes['stock_movements.show']
    update: typeof routes['stock_movements.update']
    destroy: typeof routes['stock_movements.destroy']
  }
  restocks: {
    index: typeof routes['restocks.index']
    store: typeof routes['restocks.store']
    show: typeof routes['restocks.show']
    update: typeof routes['restocks.update']
    destroy: typeof routes['restocks.destroy']
  }
  events: {
    index: typeof routes['events.index']
    store: typeof routes['events.store']
    show: typeof routes['events.show']
    update: typeof routes['events.update']
    destroy: typeof routes['events.destroy']
    getResponse: typeof routes['events.get_response']
    setResponse: typeof routes['events.set_response']
    roster: typeof routes['events.roster']
    runMatching: typeof routes['events.run_matching']
    notifyAssignments: typeof routes['events.notify_assignments']
    open: typeof routes['events.open']
    settle: typeof routes['events.settle']
  }
  eventProducts: {
    index: typeof routes['event_products.index']
    store: typeof routes['event_products.store']
    update: typeof routes['event_products.update']
    destroy: typeof routes['event_products.destroy']
    shoppingList: typeof routes['event_products.shopping_list']
    shoppingListPdf: typeof routes['event_products.shopping_list_pdf']
  }
  sponsorshipCategories: {
    index: typeof routes['sponsorship_categories.index']
    store: typeof routes['sponsorship_categories.store']
    update: typeof routes['sponsorship_categories.update']
    prices: typeof routes['sponsorship_categories.prices']
    qr: typeof routes['sponsorship_categories.qr']
    rotate: typeof routes['sponsorship_categories.rotate']
    destroy: typeof routes['sponsorship_categories.destroy']
    receivables: typeof routes['sponsorship_categories.receivables']
    receivablesPdf: typeof routes['sponsorship_categories.receivables_pdf']
  }
  orders: {
    index: typeof routes['orders.index']
    store: typeof routes['orders.store']
    sellable: typeof routes['orders.sellable']
    summary: typeof routes['orders.summary']
    setStatus: typeof routes['orders.set_status']
    destroy: typeof routes['orders.destroy']
  }
  cardPayments: {
    store: typeof routes['card_payments.store']
    show: typeof routes['card_payments.show']
    refresh: typeof routes['card_payments.refresh']
    destroy: typeof routes['card_payments.destroy']
  }
  preOrders: {
    index: typeof routes['pre_orders.index']
    setStatus: typeof routes['pre_orders.set_status']
    setPickup: typeof routes['pre_orders.set_pickup']
    collect: typeof routes['pre_orders.collect']
  }
  productionRuns: {
    index: typeof routes['production_runs.index']
    store: typeof routes['production_runs.store']
    productionPlanPdf: typeof routes['production_runs.production_plan_pdf']
    returnState: typeof routes['production_runs.return_state']
    returns: typeof routes['production_runs.returns']
    productionReturnsPdf: typeof routes['production_runs.production_returns_pdf']
  }
  assignments: {
    pdf: typeof routes['assignments.pdf']
    index: typeof routes['assignments.index']
    store: typeof routes['assignments.store']
    update: typeof routes['assignments.update']
    destroy: typeof routes['assignments.destroy']
  }
  jobs: {
    index: typeof routes['jobs.index']
    store: typeof routes['jobs.store']
    show: typeof routes['jobs.show']
    update: typeof routes['jobs.update']
    destroy: typeof routes['jobs.destroy']
  }
  eventJobs: {
    index: typeof routes['event_jobs.index']
    store: typeof routes['event_jobs.store']
    update: typeof routes['event_jobs.update']
    destroy: typeof routes['event_jobs.destroy']
  }
  responses: {
    index: typeof routes['responses.index']
  }
  preferences: {
    index: typeof routes['preferences.index']
  }
  jobEligibleMembers: {
    index: typeof routes['job_eligible_members.index']
    store: typeof routes['job_eligible_members.store']
    destroy: typeof routes['job_eligible_members.destroy']
  }
  accountPreferences: {
    preferences: {
      mine: typeof routes['account_preferences.preferences.mine']
      rankableJobs: typeof routes['account_preferences.preferences.rankable_jobs']
      updateMine: typeof routes['account_preferences.preferences.update_mine']
    }
  }
  accountAssignments: {
    assignments: {
      mine: typeof routes['account_assignments.assignments.mine']
    }
  }
  fastPasses: {
    index: typeof routes['fast_passes.index']
    store: typeof routes['fast_passes.store']
    show: typeof routes['fast_passes.show']
    update: typeof routes['fast_passes.update']
    destroy: typeof routes['fast_passes.destroy']
  }
  transactions: {
    index: typeof routes['transactions.index']
  }
  analytics: {
    season: typeof routes['analytics.season']
  }
  payments: {
    index: typeof routes['payments.index']
  }
  clients: {
    summary: typeof routes['clients.summary']
    index: typeof routes['clients.index']
    show: typeof routes['clients.show']
    update: typeof routes['clients.update']
    destroy: typeof routes['clients.destroy']
  }
  subscriptions: {
    store: typeof routes['subscriptions.store']
    destroy: typeof routes['subscriptions.destroy']
  }
  qrs: {
    verify: typeof routes['qrs.verify']
    search: typeof routes['qrs.search']
  }
  vouchers: {
    index: typeof routes['vouchers.index']
    store: typeof routes['vouchers.store']
    update: typeof routes['vouchers.update']
    destroy: typeof routes['vouchers.destroy']
  }
  logs: {
    index: typeof routes['logs.index']
    store: typeof routes['logs.store']
    show: typeof routes['logs.show']
    update: typeof routes['logs.update']
    destroy: typeof routes['logs.destroy']
  }
  sessions: {
    sessions: {
      index: typeof routes['sessions.sessions.index']
      destroy: typeof routes['sessions.sessions.destroy']
    }
  }
  notifications: {
    notifications: {
      index: typeof routes['notifications.notifications.index']
      markRead: typeof routes['notifications.notifications.mark_read']
      markAllRead: typeof routes['notifications.notifications.mark_all_read']
    }
  }
  tickets: {
    tickets: {
      index: typeof routes['tickets.tickets.index']
      store: typeof routes['tickets.tickets.store']
      show: typeof routes['tickets.tickets.show']
      reply: typeof routes['tickets.tickets.reply']
      setStatus: typeof routes['tickets.tickets.set_status']
    }
  }
  activity: {
    activity: {
      index: typeof routes['activity.activity.index']
    }
  }
  publicCatalog: {
    publicCatalog: {
      events: typeof routes['public_catalog.public_catalog.events']
      menu: typeof routes['public_catalog.public_catalog.menu']
      fastPasses: typeof routes['public_catalog.public_catalog.fast_passes']
    }
  }
  accountPurchases: {
    accountPurchases: {
      preOrders: typeof routes['account_purchases.account_purchases.pre_orders']
      preOrder: typeof routes['account_purchases.account_purchases.pre_order']
      preOrderQr: typeof routes['account_purchases.account_purchases.pre_order_qr']
      subscriptions: typeof routes['account_purchases.account_purchases.subscriptions']
      orders: typeof routes['account_purchases.account_purchases.orders']
    }
    accountPayments: {
      subscribe: typeof routes['account_purchases.account_payments.subscribe']
      preOrder: typeof routes['account_purchases.account_payments.pre_order']
      show: typeof routes['account_purchases.account_payments.show']
    }
  }
  lydia: {
    lydiaCallbacks: {
      notify: typeof routes['lydia.lydia_callbacks.notify']
    }
  }
  sumup: {
    sumupCallbacks: {
      notify: typeof routes['sumup.sumup_callbacks.notify']
    }
  }
  telegram: {
    telegramWebhook: {
      notify: typeof routes['telegram.telegram_webhook.notify']
    }
  }
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
}
