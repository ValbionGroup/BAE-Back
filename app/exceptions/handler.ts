import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import ApiException from '#exceptions/api_exception'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: any, ctx: HttpContext) {
    // Custom API exceptions thrown explicitly in controllers/services
    if (error instanceof ApiException) {
      return ctx.response.status(error.status).send({
        error: { code: error.code, message: error.message },
      })
    }

    // Lucid findOrFail → E_ROW_NOT_FOUND
    if (error.code === 'E_ROW_NOT_FOUND') {
      return ctx.response.status(404).send({
        error: { code: 'E_ROW_NOT_FOUND', message: 'Resource not found' },
      })
    }

    // VineJS validation errors
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return ctx.response.status(error.status).send({
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.messages,
        },
      })
    }

    // Auth middleware → E_UNAUTHORIZED_ACCESS
    if (error.code === 'E_UNAUTHORIZED_ACCESS') {
      return ctx.response.status(401).send({
        error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Unauthorized access' },
      })
    }

    // User.verifyCredentials → E_INVALID_CREDENTIALS
    if (error.code === 'E_INVALID_CREDENTIALS') {
      return ctx.response.status(401).send({
        error: { code: 'E_INVALID_CREDENTIALS', message: 'Invalid credentials' },
      })
    }

    // Route not found
    if (error.code === 'E_ROUTE_NOT_FOUND') {
      return ctx.response.status(404).send({
        error: { code: 'E_ROUTE_NOT_FOUND', message: 'Route not found' },
      })
    }

    // Unknown errors → 500
    return ctx.response.status(error.status || 500).send({
      error: {
        code: 'E_INTERNAL_SERVER_ERROR',
        message: this.debug ? error.message : 'Internal server error',
      },
    })
  }

  async report(error: any, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
