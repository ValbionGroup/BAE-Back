import ApiException from '#exceptions/api_exception'

export default class UnauthorizedException extends ApiException {
  constructor(message: string = 'Unauthorized access') {
    super('E_UNAUTHORIZED_ACCESS', message, 401)
  }
}
