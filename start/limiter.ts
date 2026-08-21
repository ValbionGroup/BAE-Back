import limiter from '@adonisjs/limiter/services/main'

export const throttle = {
  login: limiter.define('login', (ctx) =>
    limiter.allowRequests(10).every('5 mins').usingKey(ctx.request.ip()).blockFor('15 mins')
  ),

  passwordForgot: limiter.define('passwordForgot', (ctx) =>
    limiter.allowRequests(5).every('15 mins').usingKey(ctx.request.ip())
  ),

  passwordReset: limiter.define('passwordReset', (ctx) =>
    limiter.allowRequests(10).every('15 mins').usingKey(ctx.request.ip())
  ),

  accountSecurity: limiter.define('accountSecurity', (ctx) =>
    limiter.allowRequests(10).every('5 mins').usingKey(`user:${ctx.auth.getUserOrFail().id}`)
  ),
}
