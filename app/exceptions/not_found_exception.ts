import ApiException from '#exceptions/api_exception'

export default class NotFoundException extends ApiException {
  constructor(resource: string) {
    const code = `E_${resource.toUpperCase().replace(/ /g, '_')}_NOT_FOUND`
    super(code, `${resource} not found`, 404)
  }
}
