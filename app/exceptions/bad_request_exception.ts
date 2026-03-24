import ApiException from '#exceptions/api_exception'

export default class BadRequestException extends ApiException {
  constructor(code: string, message: string) {
    super(code, message, 400)
  }
}
