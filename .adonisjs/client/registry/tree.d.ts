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
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
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
  products: {
    summary: typeof routes['products.summary']
    ingredients: typeof routes['products.ingredients']
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
    settle: typeof routes['events.settle']
  }
  eventProducts: {
    index: typeof routes['event_products.index']
    store: typeof routes['event_products.store']
    update: typeof routes['event_products.update']
    destroy: typeof routes['event_products.destroy']
    shoppingList: typeof routes['event_products.shopping_list']
  }
  productionRuns: {
    index: typeof routes['production_runs.index']
    store: typeof routes['production_runs.store']
    returns: typeof routes['production_runs.returns']
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
  assignments: {
    index: typeof routes['assignments.index']
    store: typeof routes['assignments.store']
    update: typeof routes['assignments.update']
    destroy: typeof routes['assignments.destroy']
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
      updateMine: typeof routes['account_preferences.preferences.update_mine']
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
}
