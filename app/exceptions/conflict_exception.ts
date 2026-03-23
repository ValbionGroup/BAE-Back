import ApiException from '#exceptions/api_exception'

export default class ConflictException extends ApiException {
  constructor(resource: string) {
    const code = `E_${resource.toUpperCase().replace(/ /g, '_')}_ALREADY_EXISTS`
    super(code, `${resource} already exists`, 409)
  }
}
