import { Exception } from '@adonisjs/core/exceptions'

export default class ApiException extends Exception {
  code: string

  constructor(code: string, message: string, status: number) {
    super(message, { status, code })
    this.code = code
  }
}
