import ApiException from '#exceptions/api_exception'

export default class ForbiddenException extends ApiException {
  constructor(message: string = 'Forbidden access') {
    super('E_FORBIDDEN_ACCESS', message, 403)
  }
}
